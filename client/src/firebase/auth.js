import { auth } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";
export const doCreateUserWithEmailAndPassword = async (email, password) => {
  return createUserWithEmailAndPassword(auth, email, password);
};
export const doSignInWithEmailAndPassword = async (email, password) => {
  return signInWithEmailAndPassword(auth, email, password);
};
export const doSignOut = async () => {
  return auth.signOut();
};
export const doPasswordReset = async (email) => {
  return auth.sendPasswordResetEmail(email);
};
export const doPasswordUpdate = async (password) => {
  return auth.currentUser.updatePassword(password);
};
export const doSendEmailVerification = async () => {
  return sendEmailVerification(auth.currentUser);
};
