import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot,
  getDoc,
  writeBatch,
  serverTimestamp,
  increment
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { db, storage } from './firebase';

/**
 * Generic Firestore Operations
 */
export const firestoreService = {
  // Create document
  async create(collectionName, data) {
    try {
      const docRef = await addDoc(collection(db, collectionName), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error(`Error creating document in ${collectionName}:`, error);
      throw error;
    }
  },

  // Get document by ID
  async getById(collectionName, id) {
    try {
      const docSnap = await getDoc(doc(db, collectionName, id));
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
      return null;
    } catch (error) {
      console.error(`Error getting document from ${collectionName}:`, error);
      throw error;
    }
  },

  // Get documents with query
  async get(collectionName, queryConstraints = []) {
    try {
      const q = query(collection(db, collectionName), ...queryConstraints);
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error(`Error getting documents from ${collectionName}:`, error);
      throw error;
    }
  },

  // Update document
  async update(collectionName, id, data) {
    try {
      await updateDoc(doc(db, collectionName, id), {
        ...data,
        updatedAt: serverTimestamp()
      });
      return id;
    } catch (error) {
      console.error(`Error updating document in ${collectionName}:`, error);
      throw error;
    }
  },

  // Delete document
  async delete(collectionName, id) {
    try {
      await deleteDoc(doc(db, collectionName, id));
      return id;
    } catch (error) {
      console.error(`Error deleting document from ${collectionName}:`, error);
      throw error;
    }
  },

  // Listen to real-time changes
  listen(collectionName, queryConstraints = [], callback) {
    const q = query(collection(db, collectionName), ...queryConstraints);
    return onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(docs);
    });
  },

  // Batch operations
  async batch(operations) {
    try {
      const batch = writeBatch(db);
      
      operations.forEach(({ type, collectionName, id, data }) => {
        const docRef = id ? doc(db, collectionName, id) : doc(collection(db, collectionName));
        
        switch (type) {
          case 'create':
            batch.set(docRef, {
              ...data,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
            break;
          case 'update':
            batch.update(docRef, {
              ...data,
              updatedAt: serverTimestamp()
            });
            break;
          case 'delete':
            batch.delete(docRef);
            break;
          default:
            throw new Error(`Unknown batch operation type: ${type}`);
        }
      });

      await batch.commit();
      return true;
    } catch (error) {
      console.error('Error executing batch operations:', error);
      throw error;
    }
  }
};

/**
 * File Upload Service
 */
export const storageService = {
  // Upload file
  async uploadFile(file, path) {
    try {
      const storageRef = ref(storage, path);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      return {
        url: downloadURL,
        path: path,
        name: file.name,
        size: file.size,
        type: file.type
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  },

  // Upload multiple files
  async uploadFiles(files, basePath) {
    try {
      const uploadPromises = files.map((file, index) => {
        const fileName = `${Date.now()}_${index}_${file.name}`;
        const filePath = `${basePath}/${fileName}`;
        return this.uploadFile(file, filePath);
      });

      return await Promise.all(uploadPromises);
    } catch (error) {
      console.error('Error uploading multiple files:', error);
      throw error;
    }
  },

  // Delete file
  async deleteFile(path) {
    try {
      const storageRef = ref(storage, path);
      await deleteObject(storageRef);
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }
};

/**
 * User Service
 */
export const userService = {
  // Get user profile
  async getProfile(userId) {
    return await firestoreService.getById('users', userId);
  },

  // Update user profile
  async updateProfile(userId, data) {
    return await firestoreService.update('users', userId, data);
  },

  // Get users by company
  async getUsersByCompany(company) {
    return await firestoreService.get('users', [
      where('company', '==', company)
    ]);
  },

  // Get users by department
  async getUsersByDepartment(company, department) {
    return await firestoreService.get('users', [
      where('company', '==', company),
      where('department', '==', department)
    ]);
  }
};

/**
 * Company Service
 */
export const companyService = {
  // Create company
  async create(companyData) {
    return await firestoreService.create('companies', companyData);
  },

  // Get company by name
  async getByName(companyName) {
    const companies = await firestoreService.get('companies', [
      where('name', '==', companyName)
    ]);
    return companies.length > 0 ? companies[0] : null;
  },

  // Update employee count
  async updateEmployeeCount(companyName, increment = 1) {
    const company = await this.getByName(companyName);
    if (company) {
      return await firestoreService.update('companies', company.id, {
        employeeCount: increment(increment)
      });
    }
  }
};