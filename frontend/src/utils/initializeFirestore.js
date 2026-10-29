import { firestore } from '../config/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';

export const initializeCollections = async (userId, userEmail) => {
  try {
    // Create user profile
    await setDoc(doc(firestore, 'users', userId), {
      userId,
      email: userEmail,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Create initial assessment record
    await setDoc(doc(firestore, 'assessments', 'initial'), {
      userId,
      type: 'initial',
      data: {},
      timestamp: new Date()
    });

    return true;
  } catch (error) {
    console.error('Error initializing collections:', error);
    throw error;
  }
}; 