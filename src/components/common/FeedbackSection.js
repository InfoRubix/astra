import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Feedback as FeedbackIcon,
  Send
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';

/**
 * FeedbackSection - A fixed-position feedback form that allows any
 * authenticated user to submit feedback to the system.
 *
 * The feedback text is saved to the Firestore "feedback" collection
 * along with the current user's name, email, role, and company.
 * A success/error alert is shown after submission.
 *
 * This component has no props; user data is read from AuthContext.
 *
 * @returns {JSX.Element}
 */
function FeedbackSection() {
  const { user } = useAuth();
  const [feedbackText, setFeedbackText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleSubmit = async () => {
    if (!feedbackText.trim()) {
      setMessage({ type: 'error', text: 'Please enter your feedback' });
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'feedback'), {
        feedback: feedbackText,
        submittedBy: `${user.firstName} ${user.lastName}`,
        userId: user.uid,
        userEmail: user.email,
        role: user.role,
        company: user.originalCompanyName || user.company || 'RUBIX',
        timestamp: serverTimestamp(),
        status: 'new'
      });

      setMessage({ type: 'success', text: 'Thank you! Your feedback has been submitted.' });
      setFeedbackText('');

      // Auto-clear message after 3 seconds
      setTimeout(() => {
        setMessage({ type: '', text: '' });
      }, 3000);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      setMessage({ type: 'error', text: 'Failed to submit feedback. Please try again.' });
    }
    setSubmitting(false);
  };

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        bottom: 0,
        left: { xs: 0, sm: 280 },
        right: 0,
        zIndex: 1000,
        borderRadius: '16px 16px 0 0',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
        transition: 'all 0.3s ease'
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          bgcolor: 'primary.main',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          borderRadius: '16px 16px 0 0'
        }}
      >
        <FeedbackIcon />
        <Typography variant="h6" fontWeight={600}>
          Share Your Feedback
        </Typography>
      </Box>

      {/* Feedback Form - Always visible */}
      <Box sx={{ p: 3, bgcolor: 'background.paper' }}>
        {message.text && (
          <Alert
            severity={message.type}
            onClose={() => setMessage({ type: '', text: '' })}
            sx={{ mb: 2 }}
          >
            {message.text}
          </Alert>
        )}

        <TextField
          fullWidth
          multiline
          rows={4}
          placeholder="We'd love to hear your thoughts, suggestions, or any issues you've encountered..."
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          variant="outlined"
          disabled={submitting}
          sx={{ mb: 2 }}
        />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            Your feedback helps us improve the system
          </Typography>
          <Button
            variant="contained"
            startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <Send />}
            onClick={handleSubmit}
            disabled={submitting || !feedbackText.trim()}
            sx={{
              px: 3,
              py: 1,
              fontWeight: 600
            }}
          >
            {submitting ? 'Sending...' : 'Send Feedback'}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}

export default FeedbackSection;
