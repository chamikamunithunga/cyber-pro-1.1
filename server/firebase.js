import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import dotenv from 'dotenv';

dotenv.config();

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
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
    
    console.log('✅ Fetched', data.length, 'visitor records from Firebase');
    return data;
  } catch (error) {
    console.error('❌ Error fetching from Firebase:', error);
    throw error;
  }
}

// Get visitor data from last 30 minutes
export async function getRecentVisitorData(minutes = 30) {
  if (!db) {
    throw new Error('Firebase not initialized');
  }

  try {
    const now = new Date();
    const minutesAgo = new Date(now.getTime() - minutes * 60 * 1000);
    const timestampAgo = Timestamp.fromDate(minutesAgo);
    
    const q = query(
      collection(db, COLLECTION_NAME),
      where('createdAt', '>=', timestampAgo),
      orderBy('createdAt', 'desc')
    );
    
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

