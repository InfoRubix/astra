import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

const AuthContext = createContext();

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function login(email, password) {
    try {
      console.log('🔐 Attempting login for:', email);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('✅ Firebase Auth successful, UID:', userCredential.user.uid);

      console.log('📄 Fetching user document from Firestore...');
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));

      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.log('✅ User document found:', userData.email);

        // Check if the user account is active
        if (userData.isActive === false) {
          console.log('❌ Account is deactivated');
          // Sign out the user immediately
          await signOut(auth);
          throw new Error('Your account has been deactivated. Please contact your administrator.');
        }

        setUser({
          ...userCredential.user,
          ...userData
        });
        console.log('✅ Login successful');
        return { success: true };
      } else {
        console.error('❌ User document not found in Firestore for UID:', userCredential.user.uid);
        // Sign out the user if no profile exists
        await signOut(auth);
        throw new Error('User profile not found. Please contact your administrator.');
      }
    } catch (error) {
      console.error('❌ Login error:', error.code, error.message);

      // Provide user-friendly error messages
      let errorMessage = error.message;
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email address.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address format.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed login attempts. Please try again later.';
      }

      return { success: false, error: errorMessage };
    }
  }

  async function register(email, password, userData) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      const userProfile = {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        ...userData,
        createdAt: new Date(),
        leaveBalance: {
          annual: 12,
          sick: 14,
          emergency: 3,
          maternity: 90
        }
      };

      console.log('Creating user profile with data:', userProfile);
      console.log('User profile keys:', Object.keys(userProfile));


      try {
        await setDoc(doc(db, 'users', userCredential.user.uid), userProfile);
        console.log('User profile created successfully in Firestore');
        setUser({ ...userCredential.user, ...userProfile });
        return { success: true };
      } catch (firestoreError) {
        console.error('Failed to create user profile in Firestore:', firestoreError);
        console.error('Error code:', firestoreError.code);
        console.error('Error message:', firestoreError.message);
        
        // User was created in Auth but failed in Firestore
        return { 
          success: false, 
          error: `Account created but profile setup failed: ${firestoreError.message}. Please contact support.` 
        };
      }
    } catch (error) {
      console.error('Registration failed:', error);
      return { success: false, error: error.message };
    }
  }

  async function logout() {
    try {
      await signOut(auth);
      setUser(null);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async function resetPassword(email) {
    try {
      console.log('AuthContext: resetPassword called with email:', email);
      console.log('AuthContext: Firebase auth instance:', !!auth);
      console.log('AuthContext: Email type:', typeof email);
      
      await sendPasswordResetEmail(auth, email);
      console.log('AuthContext: sendPasswordResetEmail completed successfully');
      return { success: true };
    } catch (error) {
      console.error('AuthContext: sendPasswordResetEmail failed');
      console.error('AuthContext: Error code:', error.code);
      console.error('AuthContext: Error message:', error.message);
      console.error('AuthContext: Full error:', error);
      return { success: false, error: error.message };
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // Check if the user account is active
            if (userData.isActive === false) {
              // Sign out the user if account is deactivated
              await signOut(auth);
              setUser(null);
              setLoading(false);
              return;
            }
            
            setUser({
              ...firebaseUser,
              ...userData
            });
          } else {
            // Sign out if no user profile exists
            await signOut(auth);
            setUser(null);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    user,
    login,
    register,
    logout,
    resetPassword,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}