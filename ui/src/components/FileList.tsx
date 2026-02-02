import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  useTheme,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Delete as DeleteIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { useQuery } from '@apollo/client';
import { gql } from '@apollo/client';
import { File } from '../graphql/types';

const GET_FILES = gql`
  query GetFiles {
    getFiles {
      id
      name
      owner {
        name
      }
      versions {
        versionNumber
        size
        createdAt
      }
      permissions {
        role
      }
      createdAt
    }
  }
`;

interface FileListProps {
  onFileSelect: (file: File) => void;
}

export const FileList: React.FC<FileListProps> = ({ onFileSelect }) => {
  const { data, loading, error, refetch } = useQuery(GET_FILES);
  const theme = useTheme();

  if (loading) return <div>Loading files...</div>;
  if (error) return <div>Error loading files</div>;

  const files = data?.getFiles || [];

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Owner</TableCell>
            <TableCell>Latest Version</TableCell>
            <TableCell>Size</TableCell>
            <TableCell>Permissions</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {files.map((file: File) => (
            <TableRow key={file.id} hover onClick={() => onFileSelect(file)}>
              <TableCell>{file.name}</TableCell>
              <TableCell>{file.owner.name}</TableCell>
              <TableCell>{file.versions[0]?.versionNumber}</TableCell>
              <TableCell>{file.versions[0]?.size ? `${(file.versions[0].size / 1024).toFixed(1)} KB` : 'N/A'}</TableCell>
              <TableCell>
                {file.permissions.map((p: any) => (
                  <Chip key={p.id} label={p.role} size="small" color="primary" />
                ))}
              </TableCell>
              <TableCell>
                <IconButton size="small">
                  <DownloadIcon fontSize="small" />
                </IconButton>
                <IconButton size="small">
                  <HistoryIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" color="error">
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
