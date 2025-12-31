import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import dotenv from 'dotenv';

dotenv.config();

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyCvlUUGA4itp0mCEbMJmTEmrDW0Kp2l-U4",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "cyber-pro-76e01.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "cyber-pro-76e01",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "cyber-pro-76e01.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "612497371304",
  appId: process.env.FIREBASE_APP_ID || "1:612497371304:web:df17502f1661975ed6129d"
};

// Initialize Firebase
let app;
let db;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  console.log('✅ Firebase initialized successfully');
} catch (error) {
  console.error('❌ Firebase initialization error:', error);
  console.warn('⚠️ Falling back to in-memory storage');
}

// Collection name
const COLLECTION_NAME = 'visitorData';

// Save visitor data to Firebase
export async function saveVisitorData(data) {
  if (!db) {
    throw new Error('Firebase not initialized');
  }

  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...data,
      createdAt: Timestamp.now(),
      timestamp: data.timestamp || new Date().toISOString()
    });
    console.log('✅ Visitor data saved to Firebase with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('❌ Error saving to Firebase:', error);
    throw error;
  }
}

// Get all visitor data
export async function getAllVisitorData() {
  if (!db) {
    throw new Error('Firebase not initialized');
  }

  try {
    // Add timeout to Firebase query (25 seconds for all data)
    const queryPromise = new Promise(async (resolve, reject) => {
      try {
        const q = query(collection(db, COLLECTION_NAME), orderBy('timestamp', 'desc'));
        const querySnapshot = await getDocs(q);
        const data = [];
        
        querySnapshot.forEach((doc) => {
          const docData = doc.data();
          // Convert Firestore Timestamp to ISO string if needed
          if (docData.createdAt && docData.createdAt.toDate) {
            docData.createdAt = docData.createdAt.toDate().toISOString();
          }
          data.push({
            id: doc.id,
            ...docData
          });
        });
        
        resolve(data);
      } catch (error) {
        reject(error);
      }
    });

    // Add 25 second timeout for all data (might be large)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Firebase query timeout')), 25000);
    });

    const data = await Promise.race([queryPromise, timeoutPromise]);
    console.log('✅ Fetched', data.length, 'visitor records from Firebase');
    return data;
  } catch (error) {
    console.error('❌ Error fetching from Firebase:', error);
    throw error;
  }
}

// Check if Firebase is initialized
export function isFirebaseInitialized() {
  return db !== null && db !== undefined;
}

// Get visitor data from last 30 minutes
export async function getRecentVisitorData(minutes = 30) {
  if (!db) {
    throw new Error('Firebase not initialized');
  }

  try {
    // Add timeout to Firebase query (20 seconds)
    const queryPromise = new Promise(async (resolve, reject) => {
      try {
        const now = new Date();
        const minutesAgo = new Date(now.getTime() - minutes * 60 * 1000);
        const timestampAgo = Timestamp.fromDate(minutesAgo);
        
        // Try query with orderBy first (requires index)
        // If it fails, fall back to query without orderBy and sort in memory
        let q;
        try {
          q = query(
            collection(db, COLLECTION_NAME),
            where('createdAt', '>=', timestampAgo),
            orderBy('createdAt', 'desc')
          );
        } catch (indexError) {
          // If index doesn't exist, use simpler query and sort in memory
          console.warn('⚠️ Firestore index missing, using alternative query:', indexError.message);
          q = query(
            collection(db, COLLECTION_NAME),
            where('createdAt', '>=', timestampAgo)
          );
        }
        
        const querySnapshot = await getDocs(q);
        const data = [];
        
        querySnapshot.forEach((doc) => {
          const docData = doc.data();
          // Convert Firestore Timestamp to ISO string if needed
          if (docData.createdAt && docData.createdAt.toDate) {
            docData.createdAt = docData.createdAt.toDate().toISOString();
          }
          data.push({
            id: doc.id,
            ...docData
          });
        });
        
        // Sort by createdAt descending if we didn't use orderBy
        if (data.length > 0 && !q._queryConstraints?.some(c => c.type === 'orderBy')) {
          data.sort((a, b) => {
            const timeA = new Date(a.createdAt || a.timestamp || 0).getTime();
            const timeB = new Date(b.createdAt || b.timestamp || 0).getTime();
            return timeB - timeA; // Descending
          });
        }
        
        resolve(data);
      } catch (error) {
        reject(error);
      }
    });

    // Add 20 second timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Firebase query timeout')), 20000);
    });

    const data = await Promise.race([queryPromise, timeoutPromise]);
    console.log('✅ Fetched', data.length, 'recent visitor records (last', minutes, 'minutes) from Firebase');
    return data;
  } catch (error) {
    console.error('❌ Error fetching recent data from Firebase:', error);
    throw error;
  }
}

// Get visitor statistics
export async function getVisitorStats() {
  if (!db) {
    throw new Error('Firebase not initialized');
  }

  try {
    const allData = await getAllVisitorData();
    const uniqueIPs = new Set(allData.map(item => item.publicIP || item.ip));
    
    return {
      total: allData.length,
      unique: uniqueIPs.size
    };
  } catch (error) {
    console.error('❌ Error calculating stats:', error);
    throw error;
  }
}

export { db };

