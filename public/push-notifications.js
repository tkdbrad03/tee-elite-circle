// Push Notifications Setup
// Include this on member pages to enable live notifications

(function() {
  // VAPID public key - must match the one in Vercel environment
  const VAPID_PUBLIC_KEY = window.VAPID_PUBLIC_KEY || null;

  // Check if push is supported
  function isPushSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  // Convert VAPID key to Uint8Array
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Subscribe to push notifications
  async function subscribeToPush() {
    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Check if already subscribed
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        // Get VAPID key from server if not set
        let vapidKey = VAPID_PUBLIC_KEY;
        if (!vapidKey) {
          const res = await fetch('/api/push/vapid-key');
          if (res.ok) {
            const data = await res.json();
            vapidKey = data.publicKey;
          }
        }

        if (!vapidKey) {
          console.log('VAPID key not available');
          return null;
        }

        // Subscribe
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey)
        });
      }

      // Save subscription to server
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription })
      });

      console.log('Push subscription saved');
      return subscription;

    } catch (error) {
      console.error('Push subscription error:', error);
      return null;
    }
  }

  // Show notification prompt
  function showNotificationPrompt() {
    // Don't show if already prompted recently
    const lastPrompt = localStorage.getItem('notificationPromptDate');
    if (lastPrompt) {
      const daysSince = (Date.now() - parseInt(lastPrompt)) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) return; // Don't prompt more than once a week
    }

    // Don't show if already granted or denied
    if (Notification.permission !== 'default') return;

    // Create prompt UI
    const prompt = document.createElement('div');
    prompt.id = 'push-prompt';
    prompt.innerHTML = `
      <div class="push-prompt-content">
        <div class="push-prompt-icon">🔔</div>
        <div class="push-prompt-text">
          <strong>Never miss a live session!</strong>
          <p>Get notified when Dr. TMac goes live</p>
        </div>
        <div class="push-prompt-buttons">
          <button class="push-prompt-btn primary" id="push-enable">Enable</button>
          <button class="push-prompt-btn secondary" id="push-later">Later</button>
        </div>
      </div>
    `;

    // Add styles
    const styles = document.createElement('style');
    styles.textContent = `
      #push-prompt {
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 9999;
        animation: slideUp 0.3s ease;
      }

      @keyframes slideUp {
        from { transform: translateX(-50%) translateY(100%); opacity: 0; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; }
      }

      .push-prompt-content {
        background: #fff;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        padding: 20px 24px;
        display: flex;
        align-items: center;
        gap: 16px;
        max-width: 400px;
      }

      .push-prompt-icon {
        font-size: 32px;
      }

      .push-prompt-text strong {
        display: block;
        font-size: 14px;
        color: #1a2f23;
        margin-bottom: 4px;
      }

      .push-prompt-text p {
        font-size: 13px;
        color: #666;
        margin: 0;
      }

      .push-prompt-buttons {
        display: flex;
        gap: 8px;
        margin-left: auto;
      }

      .push-prompt-btn {
        padding: 10px 16px;
        border: none;
        border-radius: 6px;
        font-family: 'Montserrat', sans-serif;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .push-prompt-btn.primary {
        background: #1a2f23;
        color: #fff;
      }

      .push-prompt-btn.primary:hover {
        background: #2c2c2c;
      }

      .push-prompt-btn.secondary {
        background: #f0f0f0;
        color: #666;
      }

      .push-prompt-btn.secondary:hover {
        background: #e0e0e0;
      }

      @media (max-width: 500px) {
        #push-prompt {
          left: 16px;
          right: 16px;
          transform: none;
          bottom: 90px;
        }

        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .push-prompt-content {
          flex-wrap: wrap;
        }

        .push-prompt-buttons {
          width: 100%;
          margin-left: 0;
          margin-top: 12px;
        }

        .push-prompt-btn {
          flex: 1;
        }
      }
    `;

    document.head.appendChild(styles);
    document.body.appendChild(prompt);

    // Handle enable button
    document.getElementById('push-enable').addEventListener('click', async () => {
      prompt.remove();
      localStorage.setItem('notificationPromptDate', Date.now().toString());

      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        await subscribeToPush();
        showToast('Notifications enabled! You\'ll be notified when Dr. TMac goes live.');
      }
    });

    // Handle later button
    document.getElementById('push-later').addEventListener('click', () => {
      prompt.remove();
      localStorage.setItem('notificationPromptDate', Date.now().toString());
    });
  }

  // Show toast message
  function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      background: #1a2f23;
      color: #fff;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 10000;
      animation: fadeIn 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'fadeOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Initialize
  async function init() {
    if (!isPushSupported()) {
      console.log('Push notifications not supported');
      return;
    }

    // Wait for service worker
    await navigator.serviceWorker.ready;

    // Check if already subscribed
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      console.log('Already subscribed to push');
      // Re-save subscription in case member changed
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription })
      });
    } else if (Notification.permission === 'granted') {
      // Permission granted but not subscribed - subscribe now
      await subscribeToPush();
    } else if (Notification.permission === 'default') {
      // Show prompt after a delay
      setTimeout(showNotificationPrompt, 3000);
    }
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for manual triggering
  window.TeeElitePush = {
    subscribe: subscribeToPush,
    showPrompt: showNotificationPrompt
  };
})();
