import { collection, addDoc, getDoc, doc, updateDoc, deleteDoc, query, where, getDocs } from 'firebase/firestore';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, firestore } from '../config/firebase';

// Export initialized services
export { firestore };

// CRUD Operations
export const addDocument = async (collectionName, data) => {
  try {
    const docRef = await addDoc(collection(firestore, collectionName), {
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    console.error("Error adding document:", error);
    throw error;
  }
};

export const getDocument = async (collectionName, id) => {
  try {
    const docRef = doc(firestore, collectionName, id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  } catch (error) {
    console.error("Error getting document:", error);
    throw error;
  }
};

export const updateDocument = async (collectionName, id, data) => {
  try {
    const docRef = doc(firestore, collectionName, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error("Error updating document:", error);
    throw error;
  }
};

export const deleteDocument = async (collectionName, id) => {
  try {
    await deleteDoc(doc(firestore, collectionName, id));
    return true;
  } catch (error) {
    console.error("Error deleting document:", error);
    throw error;
  }
};

export const queryDocuments = async (collectionName, conditions = []) => {
  try {
    let q = collection(firestore, collectionName);
    
    conditions.forEach(({ field, operator, value }) => {
      q = query(q, where(field, operator, value));
    });
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Error querying documents:", error);
    throw error;
  }
};

// Assessment-specific operations
export const saveAssessmentResult = async (userId, assessmentType, data) => {
  try {
    return await addDocument('assessments', {
      userId,
      type: assessmentType,
      data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error saving assessment:", error);
    throw error;
  }
};

export const getUserAssessments = async (userId) => {
  try {
    return await queryDocuments('assessments', [
      { field: 'userId', operator: '==', value: userId }
    ]);
  } catch (error) {
    console.error("Error fetching user assessments:", error);
    throw error;
  }
};

// Authentication methods
export const signIn = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error("Error signing in:", error);
    throw error;
  }
};

export const signUp = async (email, password) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error("Error signing up:", error);
    throw error;
  }
};

export const signOutUser = async () => {
  try {
    await signOut(auth);
    return true;
  } catch (error) {
    console.error("Error signing out:", error);
    throw error;
  }
};

export const onAuthStateChange = (callback) => {
  return onAuthStateChanged(auth, callback);
}; 