import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp,
  setDoc,
  increment,
  runTransaction,
  startAfter,
  QueryDocumentSnapshot,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { db, auth, OperationType, handleFirestoreError } from './firebase';
import { Generation, UserProfile, Comment, Collection, Follow } from '../types';

export const generationService = {
  async create(generation: Omit<Generation, 'id' | 'createdAt' | 'likesCount' | 'commentsCount'>) {
    const path = 'generations';
    try {
      // Remove any undefined fields to prevent Firestore errors
      const cleanedData = Object.fromEntries(
        Object.entries(generation).filter(([_, v]) => v !== undefined)
      );

      const docRef = await addDoc(collection(db, path), {
        ...cleanedData,
        likesCount: 0,
        commentsCount: 0,
        createdAt: serverTimestamp()
      });
      return { id: docRef.id, ...generation };
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async getAllPublic(limitCount = 20, lastVisible?: QueryDocumentSnapshot) {
    const path = 'generations';
    try {
      let q = query(
        collection(db, path), 
        where('isPublic', '==', true), 
        orderBy('createdAt', 'desc'), 
        limit(limitCount)
      );
      
      if (lastVisible) {
        q = query(q, startAfter(lastVisible));
      }

      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Generation));
      return {
        data,
        lastVisible: snapshot.docs[snapshot.docs.length - 1]
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  async getByUser(userId: string, onlyPublic = false) {
    const path = 'generations';
    try {
      let q = query(
        collection(db, path), 
        where('userId', '==', userId), 
        orderBy('createdAt', 'desc')
      );
      
      if (onlyPublic) {
        q = query(q, where('isPublic', '==', true));
      }

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Generation));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  async like(generationId: string, userId: string) {
    const genRef = doc(db, 'generations', generationId);
    const likeRef = doc(db, 'generations', generationId, 'likes', userId);

    try {
      await runTransaction(db, async (transaction) => {
        const likeDoc = await transaction.get(likeRef);
        if (likeDoc.exists()) return; // Already liked

        transaction.set(likeRef, { userId, generationId, createdAt: serverTimestamp() });
        transaction.update(genRef, { likesCount: increment(1) });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `generations/${generationId}/likes`);
    }
  },

  async addComment(generationId: string, comment: Omit<Comment, 'id' | 'createdAt'>) {
    const genRef = doc(db, 'generations', generationId);
    const commSubColl = collection(db, 'generations', generationId, 'comments');

    try {
      await runTransaction(db, async (transaction) => {
        const docRef = await addDoc(commSubColl, {
          ...comment,
          createdAt: serverTimestamp()
        });
        transaction.update(genRef, { commentsCount: increment(1) });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `generations/${generationId}/comments`);
    }
  }
};

export const collectionService = {
  async create(userId: string, name: string, description?: string) {
    const path = `users/${userId}/collections`;
    try {
      const docRef = await addDoc(collection(db, 'users', userId, 'collections'), {
        userId,
        name,
        description,
        generationIds: [],
        createdAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async getByUser(userId: string) {
    const path = `users/${userId}/collections`;
    try {
      const q = query(collection(db, 'users', userId, 'collections'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Collection));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  async addToCollection(userId: string, collectionId: string, generationId: string) {
    const path = `users/${userId}/collections/${collectionId}`;
    try {
      const docRef = doc(db, 'users', userId, 'collections', collectionId);
      await updateDoc(docRef, {
        generationIds: arrayUnion(generationId)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
};

export const followService = {
  async follow(followerId: string, followingId: string) {
    const path = `users/${followerId}/following/${followingId}`;
    try {
      await runTransaction(db, async (transaction) => {
        const followingRef = doc(db, 'users', followerId, 'following', followingId);
        const followerRef = doc(db, 'users', followingId, 'followers', followerId);
        const followerProfileRef = doc(db, 'users', followerId);
        const followingProfileRef = doc(db, 'users', followingId);

        transaction.set(followingRef, { followerId, followingId, createdAt: serverTimestamp() });
        transaction.set(followerRef, { followerId, followingId, createdAt: serverTimestamp() });
        transaction.update(followerProfileRef, { followingCount: increment(1) });
        transaction.update(followingProfileRef, { followersCount: increment(1) });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async unfollow(followerId: string, followingId: string) {
    const path = `users/${followerId}/following/${followingId}`;
    try {
      await runTransaction(db, async (transaction) => {
        const followingRef = doc(db, 'users', followerId, 'following', followingId);
        const followerRef = doc(db, 'users', followingId, 'followers', followerId);
        const followerProfileRef = doc(db, 'users', followerId);
        const followingProfileRef = doc(db, 'users', followingId);

        transaction.delete(followingRef);
        transaction.delete(followerRef);
        transaction.update(followerProfileRef, { followingCount: increment(-1) });
        transaction.update(followingProfileRef, { followersCount: increment(-1) });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async isFollowing(followerId: string, followingId: string) {
    try {
      const docRef = doc(db, 'users', followerId, 'following', followingId);
      const snapshot = await getDoc(docRef);
      return snapshot.exists();
    } catch (error) {
      return false;
    }
  }
};
export const userService = {
  async getProfile(uid: string) {
    const path = `users/${uid}`;
    try {
      const docRef = doc(db, 'users', uid);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return snapshot.data() as UserProfile;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  },

  async updateProfile(uid: string, data: Partial<UserProfile>) {
    const path = `users/${uid}`;
    try {
      const docRef = doc(db, 'users', uid);
      await setDoc(docRef, { ...data, uid }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
};
