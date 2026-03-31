import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
  Alert,
  Avatar,
  TablePagination
} from '@mui/material';
import {
  Feedback as FeedbackIcon,
  Visibility,
  Delete,
  CheckCircle,
  Schedule
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { collection, getDocs, query, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { format } from 'date-fns';

function Feedback() {
  const { user } = useAuth();
  const [feedbackList, setFeedbackList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    loadFeedback();
  }, []);

  const loadFeedback = async () => {
    setLoading(true);
    try {
      const feedbackQuery = query(
        collection(db, 'feedback'),
        orderBy('timestamp', 'desc')
      );

      const feedbackSnapshot = await getDocs(feedbackQuery);
      const feedbackData = feedbackSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setFeedbackList(feedbackData);
      console.log('Loaded feedback:', feedbackData.length);
    } catch (error) {
      console.error('Error loading feedback:', error);
      setMessage({ type: 'error', text: 'Failed to load feedback' });
    }
    setLoading(false);
  };

  const handleViewDetails = (feedback) => {
    setSelectedFeedback(feedback);
    setDetailDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDetailDialogOpen(false);
    setSelectedFeedback(null);
  };

  const handleMarkAsResolved = async (feedbackId) => {
    try {
      await updateDoc(doc(db, 'feedback', feedbackId), {
        status: 'resolved',
        resolvedAt: new Date(),
        resolvedBy: `${user.firstName} ${user.lastName}`
      });

      setMessage({ type: 'success', text: 'Feedback marked as resolved' });
      loadFeedback();
      handleCloseDialog();
    } catch (error) {
      console.error('Error updating feedback:', error);
      setMessage({ type: 'error', text: 'Failed to update feedback' });
    }
  };

  const handleDeleteFeedback = async (feedbackId) => {
    if (!window.confirm('Are you sure you want to delete this feedback?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'feedback', feedbackId));
      setMessage({ type: 'success', text: 'Feedback deleted successfully' });
      loadFeedback();
      handleCloseDialog();
    } catch (error) {
      console.error('Error deleting feedback:', error);
      setMessage({ type: 'error', text: 'Failed to delete feedback' });
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return format(date, 'dd/MM/yyyy HH:mm');
    } catch (error) {
      return 'Invalid date';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'new':
        return 'error';
      case 'resolved':
        return 'success';
      default:
        return 'default';
    }
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const paginatedFeedback = feedbackList.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar
            sx={{
              bgcolor: 'primary.main',
              mr: 2,
              width: 56,
              height: 56,
              boxShadow: '0 4px 15px rgba(25, 118, 210, 0.3)'
            }}
          >
            <FeedbackIcon sx={{ fontSize: 28 }} />
          </Avatar>
          <Box>
            <Typography
              variant="h4"
              sx={{
                fontSize: { xs: '1.75rem', sm: '2.5rem' },
                fontWeight: 700,
                background: 'linear-gradient(45deg, #1976d2, #42a5f5)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 0.5
              }}
            >
              Feedback Management
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              View and manage user feedback
            </Typography>
          </Box>
        </Box>
        <Box
          sx={{
            width: 60,
            height: 4,
            bgcolor: 'primary.main',
            borderRadius: 2,
            opacity: 0.8
          }}
        />
      </Box>

      {/* Alert Message */}
      {message.text && (
        <Alert
          severity={message.type}
          onClose={() => setMessage({ type: '', text: '' })}
          sx={{ mb: 3 }}
        >
          {message.text}
        </Alert>
      )}

      {/* Feedback Table */}
      <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: 3, boxShadow: 3 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
            <CircularProgress size={40} />
          </Box>
        ) : feedbackList.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <FeedbackIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No feedback submitted yet
            </Typography>
          </Box>
        ) : (
          <>
            <TableContainer sx={{ maxHeight: 600 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.100' }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.100' }}>Submitted By</TableCell>
                    <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.100' }}>Company</TableCell>
                    <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.100' }}>Feedback</TableCell>
                    <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.100' }}>Status</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600, bgcolor: 'grey.100' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedFeedback.map((feedback) => (
                    <TableRow key={feedback.id} hover>
                      <TableCell>
                        {formatTimestamp(feedback.timestamp)}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.875rem' }}>
                            {feedback.submittedBy ? feedback.submittedBy.split(' ').map(n => n[0]).join('') : 'U'}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" fontWeight={600}>
                              {feedback.submittedBy || 'Unknown'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {feedback.userEmail || ''}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        {feedback.company || 'N/A'}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 300 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }}
                        >
                          {feedback.feedback}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={feedback.status || 'new'}
                          size="small"
                          color={getStatusColor(feedback.status)}
                          icon={feedback.status === 'resolved' ? <CheckCircle /> : <Schedule />}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleViewDetails(feedback)}
                          title="View Details"
                        >
                          <Visibility />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteFeedback(feedback.id)}
                          title="Delete"
                        >
                          <Delete />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25, 50]}
              component="div"
              count={feedbackList.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </>
        )}
      </Paper>

      {/* Detail Dialog */}
      <Dialog
        open={detailDialogOpen}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{
          bgcolor: 'primary.main',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <FeedbackIcon />
          Feedback Details
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {selectedFeedback && (
            <Box>
              <Box sx={{ mb: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  Submitted By
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {selectedFeedback.submittedBy}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedFeedback.userEmail}
                </Typography>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  Company
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {selectedFeedback.company}
                </Typography>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  Role
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {selectedFeedback.role}
                </Typography>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  Submitted On
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {formatTimestamp(selectedFeedback.timestamp)}
                </Typography>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  Status
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Chip
                    label={selectedFeedback.status || 'new'}
                    color={getStatusColor(selectedFeedback.status)}
                    icon={selectedFeedback.status === 'resolved' ? <CheckCircle /> : <Schedule />}
                  />
                </Box>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  Feedback
                </Typography>
                <Paper sx={{ p: 2, mt: 1, bgcolor: 'grey.50' }}>
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                    {selectedFeedback.feedback}
                  </Typography>
                </Paper>
              </Box>

              {selectedFeedback.status === 'resolved' && (
                <Box sx={{ mt: 3, p: 2, bgcolor: 'success.light', borderRadius: 2 }}>
                  <Typography variant="caption" color="success.dark">
                    Resolved By: {selectedFeedback.resolvedBy}
                  </Typography>
                  <br />
                  <Typography variant="caption" color="success.dark">
                    Resolved On: {formatTimestamp(selectedFeedback.resolvedAt)}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={handleCloseDialog}>
            Close
          </Button>
          {selectedFeedback && selectedFeedback.status !== 'resolved' && (
            <Button
              variant="contained"
              color="success"
              startIcon={<CheckCircle />}
              onClick={() => handleMarkAsResolved(selectedFeedback.id)}
            >
              Mark as Resolved
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default Feedback;
