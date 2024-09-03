'use client';
import React, { useState, useEffect } from 'react';
import { Editor } from '@monaco-editor/react';
import TreeView from './TreeView';
import InputBar from '@/components/InputBar';
import PageContainer from '@/components/layout/page-container';
import { Sparkle } from 'lucide-react';
import axios from 'axios';

import { useProjectData } from '@/context/ProjectDataContext';
import { useUserData } from '@/context/UserDataContext';

interface FileContents {
  [key: string]: string;
}

const CodeExplorer: React.FC = () => {
  const [code, setCode] = useState<string>('// Select a file to view its content');
  const [theme, setTheme] = useState<'vs-dark' | 'light'>('light');
  const [filePath, setFilePath] = useState<string>('');
  const [language, setLanguage] = useState<string>('html');
  const { projectData, setProjectData } = useProjectData();
  const { user, setUser } = useUserData();

  console.log("projectData", projectData);
  console.log("use", user);

  // Safely extract base URL from fileUrl
  const baseFileUrl = projectData?.fileUrl?.replace('.zip', '') ?? '';

  const handleFileClick = async (filePath: string) => {
    setFilePath(filePath);
    console.log('Base File URL:', baseFileUrl);
    console.log('File Path:', filePath);
  
    try {
      // Ensure the file path is correctly formatted
      const cleanFilePath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
  
      // Construct the full API URL by combining baseFileUrl and cleanFilePath
      const apiUrl = `${baseFileUrl}/${encodeURIComponent(cleanFilePath)}`;
      console.log('API URL to send to backend:', apiUrl);
  
      // Make a POST request to the backend, sending the constructed API URL
      const response = await axios.post('http://localhost:4000/fetch-file', { apiUrl });
      const fileContent = response.data;
  
      // Log the result from the backend
      console.log('File Content from backend:', fileContent);
  
      // Update the code state with the fetched content
      setCode(fileContent);
  
      // Set the language based on the file extension
      const fileExtension = cleanFilePath.split('.').pop()?.toLowerCase();
      setLanguage(getLanguageFromExtension(fileExtension));
  
    } catch (error) {
      console.error('Error fetching file content:', error);
      setCode('// Error fetching file content');
    }
  };
  
  
  
  
  // Helper function to determine the language based on file extension
  const getLanguageFromExtension = (extension: string | undefined): string => {
    switch (extension) {
      case 'js': return 'javascript';
      case 'ts': return 'typescript';
      case 'html': return 'html';
      case 'css': return 'css';
      case 'json': return 'json';
      case 'md': return 'markdown';
      // Add more cases as needed
      default: return 'plaintext';
    }
  };

  useEffect(() => {
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const updateTheme = () => {
      setTheme(darkModeMediaQuery.matches ? 'vs-dark' : 'light');
    };

    updateTheme();
    darkModeMediaQuery.addEventListener('change', updateTheme);

    return () => {
      darkModeMediaQuery.removeEventListener('change', updateTheme);
    };
  }, []);

  const handleExplainClick = () => {
    alert(`Explain the content of ${filePath}`);
  };

  return (
    <PageContainer scrollable>
      <div className="flex gap-4 p-4">
        {/* File Explorer Card */}
        <div className="flex-shrink-0 p-4 bg-white dark:bg-black rounded-lg shadow-lg md:w-1/6 w-full flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
          <h2 className="text-lg md:text-xl font-semibold mb-4">File Explorer</h2>
          <div className="flex-1 overflow-y-auto">
            <TreeView onFileClick={handleFileClick} />
          </div>
        </div>

        {/* Code Editor Card */}
        <div className="flex-1 p-4 bg-white dark:bg-black rounded-lg shadow-lg md:w-1/2 w-full relative">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg md:text-xl font-semibold">Code Editor</h2>
            <button
              className="flex items-center px-4 py-2 text-xs md:text-sm bg-white text-black border border-black rounded-full hover:bg-gray-100 focus:outline-none font-bold"
              onClick={handleExplainClick}
            >
              <Sparkle className="mr-2 h-5 w-5" />
              Explain
            </button>
          </div>

          <div className="w-full h-[400px] md:h-[500px] border border-gray-300 dark:border-gray-700 rounded-b-lg">
            <Editor
              height="100%"
              defaultLanguage="javascript"
              value={code}
              onChange={(value) => setCode(value || '')}
              theme={theme}
              language={language}
            />
          </div>
        </div>

        {/* Chat Card */}
        <div className="flex-shrink-0 flex flex-col p-4 bg-white dark:bg-black rounded-lg shadow-lg md:w-1/4 w-full">
          <h2 className="text-lg md:text-xl font-semibold mb-4">Chat</h2>
          <div className="flex-grow overflow-y-auto mb-4">
            {/* Chat messages would go here */}
          </div>
          <div className="mt-auto">
            <InputBar />
          </div>
        </div>
      </div>
    </PageContainer>
  );
};

export default CodeExplorer;