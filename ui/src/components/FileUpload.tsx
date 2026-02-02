import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Box,
  Button,
  CircularProgress,
  Typography,
  Alert,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { useMutation } from '@apollo/client';
import { gql } from '@apollo/client';

const UPLOAD_FILE = gql`
  mutation UploadFile($file: Upload!, $fileName: String!) {
    uploadFile(file: $file, fileName: $fileName) {
      id
      name
      versions {
        versionNumber
      }
    }
  }
`;

export const FileUpload: React.FC = () => {
  const [uploadFile, { loading, error }] = useMutation(UPLOAD_FILE);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      await uploadFile({
        variables: {
          file,
          fileName: file.name,
        },
      });
    }
  }, [uploadFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: false,
  });

  return (
    <Box sx={{ p: 4 }}>
      <Box
        {...getRootProps()}
        sx={{
          border: '2px dashed',
          borderColor: isDragActive ? 'primary.main' : 'grey.300',
          borderRadius: 2,
          p: 4,
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.3s',
          '&:hover': { borderColor: 'primary.main', bgcolor: 'grey.50' },
        }}
      >
        <input {...getInputProps()} />
        {loading ? (
          <CircularProgress />
        ) : (
          <>
            <CloudUploadIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6">
              {isDragActive ? 'Drop the files here ...' : 'Drag & drop files here, or click to select'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Max 10MB per file
            </Typography>
          </>
        )}
      </Box>
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          Upload failed: {error.message}
        </Alert>
      )}
    </Box>
  );
};
