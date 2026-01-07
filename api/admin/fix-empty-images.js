// Firebase Storage Upload Utility
// This handles large file uploads directly to Firebase Storage

// Firebase config will be injected by the pages that use this
let firebaseApp = null;
let storage = null;

function initializeFirebase(config) {
  if (!firebaseApp) {
    firebaseApp = firebase.initializeApp(config);
    storage = firebase.storage();
  }
  return storage;
}

// Upload file to Firebase Storage with progress tracking
async function uploadToFirebase(file, folder = 'videos', onProgress = null) {
  if (!storage) {
    throw new Error('Firebase not initialized');
  }

  // Create a unique filename
  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filename = `${folder}/${timestamp}_${sanitizedName}`;
  
  // Create storage reference
  const storageRef = storage.ref();
  const fileRef = storageRef.child(filename);
  
  // Create upload task
  const uploadTask = fileRef.put(file, {
    contentType: file.type,
    customMetadata: {
      uploadedAt: new Date().toISOString()
    }
  });
  
  // Track progress
  return new Promise((resolve, reject) => {
    uploadTask.on('state_changed',
      (snapshot) => {
        // Progress callback
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) {
          onProgress(progress, snapshot.state);
        }
      },
      (error) => {
        // Error callback
        console.error('Firebase upload error:', error);
        reject(error);
      },
      async () => {
        // Success callback
        try {
          const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
          resolve({
            url: downloadURL,
            filename: filename,
            size: file.size,
            type: file.type
          });
        } catch (error) {
          reject(error);
        }
      }
    );
  });
}

// Check if file should use Firebase (large videos) or Vercel Blob (images/small files)
function shouldUseFirebase(file, type) {
  // Use Firebase for:
  // - All videos
  // - Files over 4MB
  const isVideo = type === 'video' || file.type.startsWith('video/');
  const isLarge = file.size > 4 * 1024 * 1024; // 4MB
  
  return isVideo || isLarge;
}
