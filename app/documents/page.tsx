"use client";

// page.tsx

import { firestore } from '@/firebaseConfig';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import PageContainer from '@/components/layout/page-container';
import { useState } from 'react';
import documentsBackground from '../../public/documentsBackground.png';



interface Document {
  id: string;
  title: string;
  type: string;
  content: string;
}

async function fetchDocuments(): Promise<Document[]> {
  try {
    const querySnapshot = await getDocs(collection(firestore, 'documents'));
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Document, 'id'>),
    }));
  } catch (error) {
    console.error('Error fetching documents:', error);
    return [];
  }
}

async function fetchDocumentContent(id: string): Promise<Document | null> {
  try {
    const documentRef = doc(firestore, 'documents', id);
    const documentSnapshot = await getDoc(documentRef);
    if (documentSnapshot.exists()) {
      return {
        id: documentSnapshot.id,
        ...(documentSnapshot.data() as Omit<Document, 'id'>),
      };
    } else {
      console.error('No such document!');
      return null;
    }
  } catch (error) {
    console.error('Error fetching document content:', error);
    return null;
  }
}

export default function Page() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  useState(() => {
    fetchDocuments().then(setDocuments);
  }, []);

  const handleCardClick = async (id: string) => {
    const document = await fetchDocumentContent(id);
    if (document) {
      setSelectedDocument(document);
      setIsModalOpen(true);
    }
  };

  const openUploadModal = () => {
    setIsUploadModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedDocument(null);
  };

  const closeUploadModal = () => {
    setIsUploadModalOpen(false);
  };

  return (
    <PageContainer scrollable={true}>
      {/* Welcome Banner Section */}
      <div
        className="mb-8 bg-cover bg-center rounded-lg overflow-hidden relative"
        style={{ backgroundImage: `url(${documentsBackground.src})` }}
      >
        <div className="flex flex-col items-center justify-center h-[400px] bg-black/40 backdrop-blur-sm rounded-lg p-6">
          <div className="text-center text-white max-w-4xl">
            <h1 className="text-4xl font-semibold mb-4">Documents</h1>
            <p className="text-lg mb-4">
              Connect your custom data sources and start chatting with your own business-related data.
            </p>
            <button className="px-4 py-2 bg-white text-black rounded-lg hover:bg-black hover:text-white transition duration-300">
              Start Chatting
            </button>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Explore</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {documents.map((item) => (
            <div
              key={item.id}
              onClick={() => handleCardClick(item.id)}
              className="cursor-pointer block max-w-sm p-6 bg-white border border-gray-200 rounded-lg shadow hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700"
            >
              <h5 className="mb-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                {item.title || 'Untitled'}
              </h5>
              <p className="font-normal text-gray-700 dark:text-gray-400">
                {item.type || 'Unknown Type'}
              </p>
            </div>
          ))}
          {/* Add Document Card */}
          <div
            onClick={openUploadModal}
            className="cursor-pointer block max-w-sm p-6 bg-white border border-dashed border-gray-400 rounded-lg shadow hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700"
          >
            <h5 className="mb-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Add Document
            </h5>
            <p className="font-normal text-gray-700 dark:text-gray-400">
              Click here to add a new document.
            </p>
          </div>
        </div>
      </div>

      {/* View Document Modal */}
      {isModalOpen && selectedDocument && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg mx-auto">
            <h2 className="text-2xl font-bold mb-4">{selectedDocument.title}</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">{selectedDocument.type}</p>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{selectedDocument.content}</p>
            <button
              onClick={closeModal}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition duration-300"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold mb-6">Upload New Document</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-700 dark:text-gray-300 mb-2">Title</label>
                <input
                  type="text"
                  className="w-full p-3 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="Enter document title"
                />
              </div>
              <div>
                <label className="block text-gray-700 dark:text-gray-300 mb-2">Description</label>
                <textarea
                  className="w-full p-3 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="Enter document description"
                  rows={4}
                ></textarea>
              </div>
              <div>
                <label className="block text-gray-700 dark:text-gray-300 mb-2">Upload PDF</label>
                <input
                  type="file"
                  accept="application/pdf"
                  className="w-full p-3 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div className="flex justify-end space-x-4">
                <button
                  onClick={closeUploadModal}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition duration-300"
                >
                  Cancel
                </button>
                <button
                  onClick={() => alert('Upload functionality not implemented')}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition duration-300"
                >
                  Upload
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
