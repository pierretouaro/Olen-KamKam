import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_DIR = FileSystem.cacheDirectory + 'media_cache/';
const CACHE_INDEX_KEY = 'media_cache_index';

interface CacheEntry {
  url: string;
  localUri: string;
  type: 'image' | 'video' | 'voice';
  timestamp: number;
  size: number;
}

interface CacheIndex {
  [url: string]: CacheEntry;
}

// Max cache size: 50MB (reduced from 500MB to prevent storage bloat)
const MAX_CACHE_SIZE = 50 * 1024 * 1024;
// Max age: 1 day (reduced from 7 days)
const MAX_CACHE_AGE = 24 * 60 * 60 * 1000;

class MediaCache {
  private cacheIndex: CacheIndex = {};
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    // If already initialized, return immediately
    if (this.initialized) return;
    
    // If initialization is in progress, wait for it
    if (this.initPromise) {
      return this.initPromise;
    }
    
    // Start initialization
    this.initPromise = this.doInit();
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    try {
      // Create cache directory - ensure it exists
      await this.ensureDirectoryExists();
      
      // Load cache index
      const indexJson = await AsyncStorage.getItem(CACHE_INDEX_KEY);
      if (indexJson) {
        try {
          this.cacheIndex = JSON.parse(indexJson);
        } catch {
          this.cacheIndex = {};
        }
      }
      
      this.initialized = true;
      
      // Cleanup old files in background
      this.cleanup().catch(() => {});
    } catch (error) {
      console.error('MediaCache init error:', error);
      // Reset init promise so we can retry
      this.initPromise = null;
      throw error;
    }
  }

  private async ensureDirectoryExists(): Promise<void> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
      }
    } catch (error) {
      console.error('MediaCache ensureDirectoryExists error:', error);
      // Try one more time after a short delay
      await new Promise(resolve => setTimeout(resolve, 100));
      const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
      }
    }
  }

  private async saveIndex() {
    try {
      await AsyncStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(this.cacheIndex));
    } catch (error) {
      console.error('MediaCache saveIndex error:', error);
    }
  }

  private getCacheKey(url: string): string {
    // CRITICAL: Supabase Storage URLs contain ?token=xxx that changes constantly
    // Strip query params to create stable cache key
    const cleanUrl = url.split('?')[0];
    
    const hash = cleanUrl.split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0) | 0;
    }, 0).toString(16);
    
    const extension = cleanUrl.split('.').pop() || 'bin';
    return `${hash}.${extension}`;
  }

  async getCachedUri(url: string, type: 'image' | 'video' | 'voice'): Promise<string> {
    await this.init();
    
    // Check if already cached
    if (this.cacheIndex[url]) {
      const entry = this.cacheIndex[url];
      const fileInfo = await FileSystem.getInfoAsync(entry.localUri);
      
      if (fileInfo.exists) {
        // Update access time
        this.cacheIndex[url].timestamp = Date.now();
        await this.saveIndex();
        return entry.localUri;
      } else {
        // File was deleted, remove from index
        delete this.cacheIndex[url];
      }
    }
    
    // Return original URL (will be cached on next download)
    return url;
  }

  async downloadAndCache(url: string, type: 'image' | 'video' | 'voice'): Promise<string> {
    // Validate URL
    if (!url || typeof url !== 'string') {
      return url;
    }
    
    // Skip local file URIs - they're already local
    if (url.startsWith('file://') || url.startsWith('content://')) {
      return url;
    }
    
    // Ensure initialization is complete
    await this.init();
    
    // Ensure directory exists before downloading
    await this.ensureDirectoryExists();
    
    // Check if already cached
    if (this.cacheIndex[url]) {
      const entry = this.cacheIndex[url];
      const fileInfo = await FileSystem.getInfoAsync(entry.localUri);
      if (fileInfo.exists) {
        this.cacheIndex[url].timestamp = Date.now();
        await this.saveIndex();
        return entry.localUri;
      }
    }

    try {
      const cacheKey = this.getCacheKey(url);
      const localUri = CACHE_DIR + cacheKey;
      
      // Check if file already exists (from previous partial download)
      const existingFile = await FileSystem.getInfoAsync(localUri);
      if (existingFile.exists) {
        await FileSystem.deleteAsync(localUri).catch(() => {});
      }
      
      // Download file with timeout
      const downloadPromise = FileSystem.downloadAsync(url, localUri);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Download timeout')), 30000)
      );
      
      const downloadResult = await Promise.race([downloadPromise, timeoutPromise]) as FileSystem.FileSystemDownloadResult;
      
      if (downloadResult.status === 200) {
        // Get file size
        const fileInfo = await FileSystem.getInfoAsync(localUri);
        const size = fileInfo.exists && 'size' in fileInfo ? (fileInfo as FileSystem.FileInfo & { size: number }).size || 0 : 0;
        
        // Add to index
        this.cacheIndex[url] = {
          url,
          localUri,
          type,
          timestamp: Date.now(),
          size,
        };
        
        await this.saveIndex();
        
        // Trigger cleanup if cache is getting large
        this.cleanup().catch(() => {});
        
        return localUri;
      }
    } catch (error) {
      // Silently fail - don't spam console with download errors
      // This is expected for invalid URLs, network issues, etc.
    }
    
    // Return original URL if download failed
    return url;
  }

  async preload(url: string, type: 'image' | 'video' | 'voice'): Promise<void> {
    // Preload in background without blocking
    this.downloadAndCache(url, type).catch(() => {});
  }

  async preloadMultiple(urls: Array<{ url: string; type: 'image' | 'video' | 'voice' }>): Promise<void> {
    // DISABLED: Preloading hammers Supabase with requests
    // Each component now handles its own caching on demand
    // This prevents downloading 20 images every time chat opens
    return;
  }

  private async cleanup() {
    try {
      const entries = Object.values(this.cacheIndex);
      const now = Date.now();
      
      // Calculate total size
      const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
      
      // Remove old entries and entries for deleted files
      const toDelete: string[] = [];
      
      for (const [url, entry] of Object.entries(this.cacheIndex)) {
        // Check if file still exists
        const fileInfo = await FileSystem.getInfoAsync(entry.localUri);
        
        if (!fileInfo.exists || now - entry.timestamp > MAX_CACHE_AGE) {
          toDelete.push(url);
          if (fileInfo.exists) {
            await FileSystem.deleteAsync(entry.localUri).catch(() => {});
          }
        }
      }
      
      // Remove from index
      for (const url of toDelete) {
        delete this.cacheIndex[url];
      }
      
      // If still over size limit, remove least recently used
      let currentSize = totalSize - toDelete.reduce((sum, url) => sum + (this.cacheIndex[url]?.size || 0), 0);
      
      if (currentSize > MAX_CACHE_SIZE) {
        const sortedEntries = entries
          .filter(e => this.cacheIndex[e.url]) // Only existing entries
          .sort((a, b) => a.timestamp - b.timestamp); // Oldest first
        
        for (const entry of sortedEntries) {
          if (currentSize <= MAX_CACHE_SIZE) break;
          
          await FileSystem.deleteAsync(entry.localUri).catch(() => {});
          delete this.cacheIndex[entry.url];
          currentSize -= entry.size;
        }
      }
      
      await this.saveIndex();
    } catch (error) {
      console.error('MediaCache cleanup error:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
      await this.ensureDirectoryExists();
      this.cacheIndex = {};
      await this.saveIndex();
    } catch (error) {
      console.error('MediaCache clear error:', error);
    }
  }

  getCacheSize(): number {
    return Object.values(this.cacheIndex).reduce((sum, entry) => sum + entry.size, 0);
  }

  getCachedUrls(): string[] {
    return Object.keys(this.cacheIndex);
  }
}

// Singleton instance
export const mediaCache = new MediaCache();
