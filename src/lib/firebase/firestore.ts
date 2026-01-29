import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  DocumentData,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from './config';
import type {
  Project,
  ProjectDocument,
  Chapter,
  ChapterVersion,
  EditorialIssue,
  RevisionTask,
} from '@/types';

// Helper to convert Firestore timestamps
function convertTimestamps<T extends DocumentData>(data: T): T {
  const converted = { ...data };
  for (const key in converted) {
    const value = converted[key];
    if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
      (converted as Record<string, unknown>)[key] = value.toDate();
    }
  }
  return converted;
}

// Projects
export async function createProject(
  userId: string,
  data: Omit<Project, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  // Filter out undefined values as Firestore doesn't accept them
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([_, value]) => value !== undefined)
  );
  
  const docRef = await addDoc(collection(db, 'projects'), {
    ...cleanData,
    userId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function getProject(projectId: string): Promise<Project | null> {
  const docRef = doc(db, 'projects', projectId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return convertTimestamps({ id: docSnap.id, ...docSnap.data() }) as Project;
}

export async function getUserProjects(userId: string): Promise<Project[]> {
  const q = query(
    collection(db, 'projects'),
    where('userId', '==', userId),
    orderBy('updatedAt', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(
    (doc) => convertTimestamps({ id: doc.id, ...doc.data() }) as Project
  );
}

export async function updateProject(
  projectId: string,
  data: Partial<Omit<Project, 'id' | 'userId' | 'createdAt'>>
): Promise<void> {
  // Filter out undefined values as Firestore doesn't accept them
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([_, value]) => value !== undefined)
  );
  
  const docRef = doc(db, 'projects', projectId);
  await updateDoc(docRef, {
    ...cleanData,
    updatedAt: Timestamp.now(),
  });
}

export async function deleteProject(projectId: string): Promise<void> {
  const docRef = doc(db, 'projects', projectId);
  await deleteDoc(docRef);
}

// Project Documents
export async function createDocument(
  data: Omit<ProjectDocument, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const docRef = await addDoc(collection(db, 'documents'), {
    ...data,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function getDocument(documentId: string): Promise<ProjectDocument | null> {
  const docRef = doc(db, 'documents', documentId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return convertTimestamps({ id: docSnap.id, ...docSnap.data() }) as ProjectDocument;
}

export async function getProjectDocuments(projectId: string): Promise<ProjectDocument[]> {
  const q = query(
    collection(db, 'documents'),
    where('projectId', '==', projectId),
    orderBy('createdAt', 'asc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(
    (doc) => convertTimestamps({ id: doc.id, ...doc.data() }) as ProjectDocument
  );
}

export async function getDocumentByType(
  projectId: string,
  type: string
): Promise<ProjectDocument | null> {
  const q = query(
    collection(db, 'documents'),
    where('projectId', '==', projectId),
    where('type', '==', type),
    orderBy('version', 'desc'),
    limit(1)
  );
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) return null;
  const doc = querySnapshot.docs[0];
  return convertTimestamps({ id: doc.id, ...doc.data() }) as ProjectDocument;
}

export async function updateDocument(
  documentId: string,
  data: Partial<Omit<ProjectDocument, 'id' | 'projectId' | 'createdAt'>>
): Promise<void> {
  const docRef = doc(db, 'documents', documentId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

// Chapters
export async function createChapter(
  data: Omit<Chapter, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const docRef = await addDoc(collection(db, 'chapters'), {
    ...data,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function getChapter(chapterId: string): Promise<Chapter | null> {
  const docRef = doc(db, 'chapters', chapterId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return convertTimestamps({ id: docSnap.id, ...docSnap.data() }) as Chapter;
}

export async function getProjectChapters(projectId: string): Promise<Chapter[]> {
  const q = query(
    collection(db, 'chapters'),
    where('projectId', '==', projectId),
    orderBy('chapterNumber', 'asc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(
    (doc) => convertTimestamps({ id: doc.id, ...doc.data() }) as Chapter
  );
}

export async function updateChapter(
  chapterId: string,
  data: Partial<Omit<Chapter, 'id' | 'projectId' | 'createdAt'>>
): Promise<void> {
  const docRef = doc(db, 'chapters', chapterId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

// Chapter Versions
export async function createChapterVersion(
  data: Omit<ChapterVersion, 'id' | 'createdAt'>
): Promise<string> {
  const docRef = await addDoc(collection(db, 'chapter_versions'), {
    ...data,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function getChapterVersions(chapterId: string): Promise<ChapterVersion[]> {
  const q = query(
    collection(db, 'chapter_versions'),
    where('chapterId', '==', chapterId),
    orderBy('version', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(
    (doc) => convertTimestamps({ id: doc.id, ...doc.data() }) as ChapterVersion
  );
}

export async function getLatestChapterVersion(chapterId: string): Promise<ChapterVersion | null> {
  const q = query(
    collection(db, 'chapter_versions'),
    where('chapterId', '==', chapterId),
    orderBy('version', 'desc'),
    limit(1)
  );
  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) return null;
  const doc = querySnapshot.docs[0];
  return convertTimestamps({ id: doc.id, ...doc.data() }) as ChapterVersion;
}

export async function getApprovedChapterVersions(projectId: string): Promise<ChapterVersion[]> {
  const q = query(
    collection(db, 'chapter_versions'),
    where('projectId', '==', projectId),
    where('approved', '==', true),
    orderBy('chapterNumber', 'asc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(
    (doc) => convertTimestamps({ id: doc.id, ...doc.data() }) as ChapterVersion
  );
}

export async function updateChapterVersion(
  versionId: string,
  data: Partial<Omit<ChapterVersion, 'id' | 'chapterId' | 'createdAt'>>
): Promise<void> {
  const docRef = doc(db, 'chapter_versions', versionId);
  await updateDoc(docRef, data);
}

// Editorial Issues
export async function createEditorialIssue(
  data: Omit<EditorialIssue, 'id' | 'createdAt'>
): Promise<string> {
  const docRef = await addDoc(collection(db, 'editorial_issues'), {
    ...data,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function getProjectEditorialIssues(projectId: string): Promise<EditorialIssue[]> {
  const q = query(
    collection(db, 'editorial_issues'),
    where('projectId', '==', projectId),
    orderBy('chapterNumber', 'asc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(
    (doc) => convertTimestamps({ id: doc.id, ...doc.data() }) as EditorialIssue
  );
}

export async function updateEditorialIssue(
  issueId: string,
  data: Partial<Omit<EditorialIssue, 'id' | 'projectId' | 'createdAt'>>
): Promise<void> {
  const docRef = doc(db, 'editorial_issues', issueId);
  await updateDoc(docRef, data);
}

// Revision Tasks
export async function createRevisionTask(
  data: Omit<RevisionTask, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const docRef = await addDoc(collection(db, 'revision_tasks'), {
    ...data,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function getProjectRevisionTasks(projectId: string): Promise<RevisionTask[]> {
  const q = query(
    collection(db, 'revision_tasks'),
    where('projectId', '==', projectId),
    orderBy('chapterNumber', 'asc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(
    (doc) => convertTimestamps({ id: doc.id, ...doc.data() }) as RevisionTask
  );
}

export async function updateRevisionTask(
  taskId: string,
  data: Partial<Omit<RevisionTask, 'id' | 'projectId' | 'createdAt'>>
): Promise<void> {
  const docRef = doc(db, 'revision_tasks', taskId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

// Batch operations for cleanup
export async function deleteProjectData(projectId: string): Promise<void> {
  // Delete all related documents
  const collections = ['documents', 'chapters', 'chapter_versions', 'editorial_issues', 'revision_tasks'];
  
  for (const collectionName of collections) {
    const q = query(collection(db, collectionName), where('projectId', '==', projectId));
    const querySnapshot = await getDocs(q);
    for (const docSnap of querySnapshot.docs) {
      await deleteDoc(doc(db, collectionName, docSnap.id));
    }
  }
  
  // Delete the project itself
  await deleteProject(projectId);
}
