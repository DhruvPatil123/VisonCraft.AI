export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  bio?: string;
  role: 'user' | 'admin';
  followersCount?: number;
  followingCount?: number;
  createdAt: any; // Firestore Timestamp
}

export interface Generation {
  id: string;
  userId: string;
  prompt: string;
  negativePrompt?: string;
  strength?: number;
  imageUrl?: string;
  videoUrl?: string;
  type: 'image' | 'video';
  style?: string;
  aspectRatio?: string;
  isPublic: boolean;
  likesCount: number;
  commentsCount: number;
  createdAt: any;
}

export interface Collection {
  id: string;
  userId: string;
  name: string;
  description?: string;
  generationIds: string[];
  createdAt: any;
}

export interface Follow {
  followerId: string;
  followingId: string;
  createdAt: any;
}

export interface Comment {
  id: string;
  userId: string;
  generationId: string;
  text: string;
  userName?: string;
  userPhoto?: string;
  createdAt: any;
}

export interface Like {
  userId: string;
  generationId: string;
  createdAt: any;
}
