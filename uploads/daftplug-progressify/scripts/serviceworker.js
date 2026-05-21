const CACHE_VERSION = 'cae2a7c4';
const CACHE_PREFIX = 'daftplug-progressify';
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js');
      self.addEventListener('install', () => self.skipWaiting());
      self.addEventListener('activate', () => self.clients.claim());
      self.addEventListener('message', (event) => {
        if (event.data?.type === 'SKIP_WAITING') {
          self.skipWaiting();
        }
      });
    
      workbox.loadModule('workbox-background-sync');

      workbox.routing.registerRoute(
        ({ url, request }) => {
          // Only queue same-origin POST requests
          if (request.method !== 'POST') return false;

          // Exclude admin area
          if (url.pathname.includes('/wp-admin')) return false;

          // Exclude CSP reporting endpoints
          if (url.hostname === 'csp.withgoogle.com' || url.pathname.includes('/csp/')) return false;

          // Exclude other external domains (only allow same-origin)
          if (url.origin !== self.location.origin) return false;

          // Exclude specific patterns that should not be queued
          const excludePatterns = [
            '/wp-json/wp/',
            '/wp-cron.php',
            '/xmlrpc.php'
          ];

          if (excludePatterns.some(pattern => url.pathname.includes(pattern))) return false;

          return true;
        },
        new workbox.strategies.NetworkOnly({
          plugins: [
            new workbox.backgroundSync.BackgroundSyncPlugin('backgroundSyncQueue', {
              maxRetentionTime: 24 * 60, // Retry for 24 hours (in minutes)
              onSync: async ({ queue }) => {
                try {
                  await queue.replayRequests();
                  console.log('Background sync completed');
                } catch (error) {
                  console.error('Background sync failed:', error);
                  throw error;
                }
              }
            })
          ]
        })
      );
    
    async function fetchAndCacheContent() {
    try {
    const request = 'https://clean-up.ma/';
    const cache = await caches.open(CACHE_PREFIX + '-periodic-' + CACHE_VERSION);

    const response = await fetch(request, {
    credentials: 'same-origin',
    headers: {
    'Accept': 'text/html',
    'Cache-Control': 'no-cache'
    }
    });

    if (!response.ok) {
    throw new Error('Periodic sync fetch failed: ' + response.status);
    }

    await cache.put(request, response.clone());

    // Clean up old cached responses
    const keys = await cache.keys();
    await Promise.all(
    keys.map(key => {
    if (key.url !== request) {
    return cache.delete(key);
    }
    })
    );

    console.log('Periodic sync completed successfully');
    } catch (error) {
    console.error('Periodic sync error:', error);
    }
    }

    self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'content-sync') {
    event.waitUntil(fetchAndCacheContent());
    }
    });
    
      const DB_NAME = 'badge-db';
      const STORE_NAME = 'badge-store';
      const DB_VERSION = 1;

      /**
       * Open (or create) the IndexedDB for badge tracking
       */
      function openBadgeDb() {
        return new Promise((resolve, reject) => {
          const request = indexedDB.open(DB_NAME, DB_VERSION);
          request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              db.createObjectStore(STORE_NAME, { keyPath: 'key' });
            }
          };
          request.onsuccess = (event) => {
            resolve(event.target.result);
          };
          request.onerror = (event) => {
            reject('IndexedDB error: ' + event.target.error);
          };
        });
      }

      /**
       * Retrieve the current stored badge count
       */
      function getBadgeCount() {
        return openBadgeDb().then(db => {
          return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get('count');
            request.onsuccess = () => {
              if (request.result) {
                resolve(request.result.value);
              } else {
                resolve(0);
              }
            };
            request.onerror = () => reject(request.error);
          });
        });
      }

      /**
       * Set/update the stored badge count
       */
      function setBadgeCount(count) {
        return openBadgeDb().then(db => {
          return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.put({ key: 'count', value: Math.max(0, count) });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
          });
        });
      }

      /**
       * Update the app badge if the browser supports it
       */
      async function updateAppBadge(count) {
        if ('setAppBadge' in navigator && 'clearAppBadge' in navigator) {
          try {
            if (count > 0) {
              await navigator.setAppBadge(count);
            } else {
              await navigator.clearAppBadge();
            }
          } catch (err) {
            console.log('Error updating badge:', err);
          }
        }
      }

      /**
       * Sync the badge count with the actual number of notifications
       * currently displayed by this Service Worker.
       */
      async function syncBadgeWithNotifications() {
        try {
          const notifications = await self.registration.getNotifications();
          const activeCount = notifications.length;
          
          // Update our stored count
          await setBadgeCount(activeCount);
          // Update the visual badge
          await updateAppBadge(activeCount);
        } catch (err) {
          console.log('Error in syncBadgeWithNotifications:', err);
        }
      }

      /**
       * Handle the 'push' event.
       * - Show the new notification.
       * - Increment the local count.
       * - Update the badge.
       * - Then schedule a quick sync.
       */
      self.addEventListener('push', (event) => {
        if (!event.data) {
          console.log('No push data fetched');
          return;
        }

        const notificationData = event.data.json();

        event.waitUntil((async () => {
          // Show the notification
          await self.registration.showNotification(notificationData.title, notificationData);

          // Increment the stored count
          let currentCount = await getBadgeCount();
          currentCount++;
          await setBadgeCount(currentCount);
          await updateAppBadge(currentCount);

          // Double-check actual notifications after a short delay
          setTimeout(() => {
            syncBadgeWithNotifications();
          }, 1500);
        })());
      });

      /**
       * Handle notification click.
       * - Close the notification.
       * - Sync the badge with actual notifications right away.
       * - Optionally open a URL if specified.
       */
      self.addEventListener('notificationclick', (event) => {
        event.notification.close();

        let urlToOpen = '';
        switch (event.action) {
          case 'action0':
            urlToOpen = event.notification.data.pushActionButton0Url;
            break;
          case 'action1':
            urlToOpen = event.notification.data.pushActionButton1Url;
            break;
          default:
            urlToOpen = event.notification.data.url;
            break;
        }

        event.waitUntil((async () => {
          // Immediately re-check how many notifications are visible
          await syncBadgeWithNotifications();

          if (clients.openWindow && urlToOpen) {
            await clients.openWindow(urlToOpen);
          }
        })());
      });

      /**
       * Because iOS doesn't reliably fire 'notificationclose', 
       * we add a background interval to sync with actual notifications.
       */
      const BADGE_SYNC_INTERVAL = 5000; // 5 seconds
      setInterval(() => {
        syncBadgeWithNotifications();
      }, BADGE_SYNC_INTERVAL);

      /**
       * Listen for push subscription changes
       */
      self.addEventListener('pushsubscriptionchange', function(event) {
        event.waitUntil(
          fetch('https://clean-up.ma/wp-json/daftplug-progressify/updateSubscription', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              oldEndpoint: event.oldSubscription ? event.oldSubscription.endpoint : null,
              newEndpoint: event.newSubscription ? event.newSubscription.endpoint : null,
              newAuthKey: event.newSubscription ? event.newSubscription.toJSON().keys.auth : null,
              newP256dhKey: event.newSubscription ? event.newSubscription.toJSON().keys.p256dh : null,
            })
          })
          .then(response => {
            if (!response.ok) {
              throw new Error('Network response was not ok');
            }
            return response.json();
          })
          .then(data => {
            if (data.status === 'success') {
              return data;
            }
            throw new Error('Subscription updating failed');
          })
        );
      });
    