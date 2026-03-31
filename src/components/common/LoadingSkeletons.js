import React from 'react';
import {
  Box,
  Grid,
  Paper,
  Card,
  CardContent,
  Skeleton,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';

// ---------------------------------------------------------------------------
// DashboardSkeleton
// Mimics a full dashboard layout: 4 stat cards, a chart area, and a list.
// ---------------------------------------------------------------------------
export function DashboardSkeleton() {
  return (
    <Box>
      {/* 4 Stat Cards */}
      <Grid container spacing={{ xs: 2, sm: 3 }} sx={{ mb: { xs: 2, sm: 4 } }}>
        {[
          { bg: '#e3f2fd', darkBg: '#0d2137' },
          { bg: '#e8f5e9', darkBg: '#0d2b0f' },
          { bg: '#fff3e0', darkBg: '#2b1d0d' },
          { bg: '#ffebee', darkBg: '#2b0d0d' },
        ].map((stat, index) => (
          <Grid item xs={6} sm={6} md={3} key={index}>
            <Card
              sx={{
                height: '100%',
                borderRadius: 3,
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                border: '1px solid',
                borderColor: 'divider',
                background: (theme) => theme.palette.mode === 'dark'
                  ? `linear-gradient(135deg, #1a1a1a 0%, ${stat.darkBg} 100%)`
                  : `linear-gradient(135deg, #ffffff 0%, ${stat.bg} 100%)`,
              }}
            >
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    flexDirection: { xs: 'column', sm: 'row' },
                  }}
                >
                  <Skeleton
                    variant="circular"
                    width={48}
                    height={48}
                    animation="wave"
                    sx={{ mr: { xs: 0, sm: 2 }, mb: { xs: 1, sm: 0 }, flexShrink: 0 }}
                  />
                  <Box sx={{ textAlign: { xs: 'center', sm: 'left' }, flex: 1, width: '100%' }}>
                    <Skeleton variant="text" width={60} height={36} animation="wave" sx={{ mb: 0.5 }} />
                    <Skeleton variant="text" width={100} height={20} animation="wave" />
                    <Skeleton variant="text" width={80} height={16} animation="wave" />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Chart + Sidebar */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Chart Area */}
        <Grid item xs={12} md={8}>
          <Card
            sx={{
              borderRadius: 3,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Skeleton variant="text" width={200} height={32} animation="wave" />
                <Skeleton variant="rectangular" width={180} height={40} animation="wave" sx={{ borderRadius: 1 }} />
              </Box>
              <Skeleton
                variant="rectangular"
                width="100%"
                height={300}
                animation="wave"
                sx={{ borderRadius: 2 }}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Sidebar / Pie Chart Area */}
        <Grid item xs={12} md={4}>
          <Card
            sx={{
              height: '100%',
              borderRadius: 3,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <CardContent>
              <Skeleton variant="text" width={180} height={32} animation="wave" sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 250 }}>
                <Skeleton variant="circular" width={160} height={160} animation="wave" />
              </Box>
              <Box sx={{ mt: 2 }}>
                {[1, 2, 3].map((item) => (
                  <Box key={item} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Skeleton variant="rectangular" width={12} height={12} animation="wave" sx={{ mr: 1, borderRadius: 1 }} />
                    <Skeleton variant="text" width="60%" height={20} animation="wave" sx={{ flex: 1 }} />
                    <Skeleton variant="text" width={30} height={20} animation="wave" />
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* List Area */}
      <Card
        sx={{
          borderRadius: 3,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <CardContent>
          <Skeleton variant="text" width={180} height={32} animation="wave" sx={{ mb: 2 }} />
          {[1, 2, 3, 4].map((item) => (
            <Box key={item}>
              <Box sx={{ display: 'flex', alignItems: 'center', py: 1.5 }}>
                <Skeleton variant="circular" width={40} height={40} animation="wave" sx={{ mr: 2 }} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton variant="text" width="40%" height={22} animation="wave" sx={{ mb: 0.5 }} />
                  <Skeleton variant="text" width="65%" height={18} animation="wave" />
                </Box>
                <Skeleton variant="rectangular" width={80} height={28} animation="wave" sx={{ borderRadius: 2 }} />
              </Box>
              {item < 4 && <Divider />}
            </Box>
          ))}
        </CardContent>
      </Card>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// TableSkeleton
// Mimics a data table with a header row and data rows.
// Props: { rows = 5, columns = 4 }
// ---------------------------------------------------------------------------
export function TableSkeleton({ rows = 5, columns = 4 }) {
  // Alternate widths to give a more realistic table feel
  const widthPattern = ['80%', '60%', '90%', '70%', '50%'];

  return (
    <Card
      sx={{
        borderRadius: 3,
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
      }}
    >
      {/* Header Row */}
      <Box
        sx={{
          display: 'flex',
          px: 3,
          py: 2,
          bgcolor: 'grey.50',
          borderBottom: '2px solid',
          borderColor: 'divider',
          gap: 2,
        }}
      >
        {Array.from({ length: columns }).map((_, col) => (
          <Box key={col} sx={{ flex: 1 }}>
            <Skeleton
              variant="text"
              width="70%"
              height={24}
              animation="wave"
              sx={{ bgcolor: 'grey.300' }}
            />
          </Box>
        ))}
      </Box>

      {/* Data Rows */}
      {Array.from({ length: rows }).map((_, row) => (
        <Box key={row}>
          <Box
            sx={{
              display: 'flex',
              px: 3,
              py: 2,
              gap: 2,
              bgcolor: row % 2 === 0 ? 'transparent' : 'grey.50',
              transition: 'background-color 0.2s',
            }}
          >
            {Array.from({ length: columns }).map((_, col) => (
              <Box key={col} sx={{ flex: 1 }}>
                <Skeleton
                  variant="text"
                  width={widthPattern[(row + col) % widthPattern.length]}
                  height={22}
                  animation="wave"
                />
              </Box>
            ))}
          </Box>
          {row < rows - 1 && <Divider />}
        </Box>
      ))}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// AttendanceCardSkeleton
// Mimics the attendance recording page's current status card.
// ---------------------------------------------------------------------------
export function AttendanceCardSkeleton() {
  return (
    <Card
      sx={{
        borderRadius: 3,
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        border: '1px solid',
        borderColor: 'divider',
        background: (theme) => theme.palette.mode === 'dark'
          ? 'linear-gradient(135deg, #1a1a1a 0%, #0d0d1f 100%)'
          : 'linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%)',
      }}
    >
      <CardContent sx={{ p: 4 }}>
        {/* Header with icon + title */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 3 }}>
          <Skeleton
            variant="circular"
            width={56}
            height={56}
            animation="wave"
            sx={{ mr: 2, flexShrink: 0 }}
          />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width={160} height={32} animation="wave" sx={{ mb: 0.5 }} />
            <Skeleton variant="rectangular" width={40} height={3} animation="wave" sx={{ borderRadius: 1.5 }} />
          </Box>
        </Box>

        <Box sx={{ textAlign: 'center', py: 3 }}>
          {/* Digital Clock Skeleton */}
          <Paper
            sx={{
              p: 3,
              mb: 3,
              bgcolor: 'primary.50',
              border: '2px solid',
              borderColor: 'primary.100',
              borderRadius: 3,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <Skeleton
              variant="text"
              width={220}
              height={64}
              animation="wave"
            />
          </Paper>

          {/* Status Chip Skeleton */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
            <Skeleton
              variant="rectangular"
              width={140}
              height={40}
              animation="wave"
              sx={{ borderRadius: 20 }}
            />
          </Box>

          {/* Info Section Skeleton */}
          <Box
            sx={{
              p: 2,
              bgcolor: 'grey.50',
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'grey.200',
              mb: 3,
            }}
          >
            <Skeleton variant="text" width="60%" height={20} animation="wave" sx={{ mx: 'auto', mb: 1 }} />
            <Skeleton variant="text" width="40%" height={20} animation="wave" sx={{ mx: 'auto', mb: 1 }} />
            <Skeleton variant="text" width="35%" height={20} animation="wave" sx={{ mx: 'auto' }} />
          </Box>

          {/* Action Buttons Skeleton */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Skeleton
              variant="rectangular"
              width={140}
              height={48}
              animation="wave"
              sx={{ borderRadius: 3 }}
            />
            <Skeleton
              variant="rectangular"
              width={140}
              height={48}
              animation="wave"
              sx={{ borderRadius: 3 }}
            />
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// ListItemSkeleton
// Mimics list items with an avatar and two lines of text.
// Props: { count = 5 }
// ---------------------------------------------------------------------------
export function ListItemSkeleton({ count = 5 }) {
  return (
    <Card
      sx={{
        borderRadius: 3,
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <List sx={{ p: 0 }}>
          {Array.from({ length: count }).map((_, index) => (
            <React.Fragment key={index}>
              <ListItem sx={{ px: 0, py: 2 }}>
                <ListItemIcon>
                  <Skeleton variant="circular" width={40} height={40} animation="wave" />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Skeleton
                      variant="text"
                      width="30%"
                      height={24}
                      animation="wave"
                      sx={{ mb: 0.5 }}
                    />
                  }
                  secondary={
                    <Box>
                      <Skeleton variant="text" width="60%" height={20} animation="wave" sx={{ mb: 0.5 }} />
                      <Skeleton variant="text" width="45%" height={20} animation="wave" />
                    </Box>
                  }
                />
                <Skeleton
                  variant="rectangular"
                  width={100}
                  height={32}
                  animation="wave"
                  sx={{ borderRadius: 2, flexShrink: 0 }}
                />
              </ListItem>
              {index < count - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// FormSkeleton
// Mimics a form with label + input field skeletons and a submit button.
// Props: { fields = 4 }
// ---------------------------------------------------------------------------
export function FormSkeleton({ fields = 4 }) {
  // Alternate field widths for visual variety
  const fieldWidths = ['100%', '100%', '60%', '80%', '100%', '50%'];

  return (
    <Card
      sx={{
        borderRadius: 3,
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
        {/* Form Title */}
        <Skeleton variant="text" width={200} height={36} animation="wave" sx={{ mb: 3 }} />

        {/* Field Rows */}
        {Array.from({ length: fields }).map((_, index) => (
          <Box key={index} sx={{ mb: 3 }}>
            {/* Label */}
            <Skeleton
              variant="text"
              width={120}
              height={20}
              animation="wave"
              sx={{ mb: 1 }}
            />
            {/* Input Field */}
            <Skeleton
              variant="rectangular"
              width={fieldWidths[index % fieldWidths.length]}
              height={56}
              animation="wave"
              sx={{ borderRadius: 1 }}
            />
          </Box>
        ))}

        {/* Divider before button */}
        <Divider sx={{ my: 3 }} />

        {/* Submit Button */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <Skeleton
            variant="rectangular"
            width={100}
            height={44}
            animation="wave"
            sx={{ borderRadius: 3 }}
          />
          <Skeleton
            variant="rectangular"
            width={140}
            height={44}
            animation="wave"
            sx={{ borderRadius: 3 }}
          />
        </Box>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// ProfileSkeleton
// Mimics a user profile card with avatar, name, email, and info rows.
// ---------------------------------------------------------------------------
export function ProfileSkeleton() {
  return (
    <Card
      sx={{
        borderRadius: 3,
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        border: '1px solid',
        borderColor: 'divider',
        background: (theme) => theme.palette.mode === 'dark'
          ? 'linear-gradient(135deg, #1a1a1a 0%, #0d0d1f 100%)'
          : 'linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%)',
      }}
    >
      <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
        {/* Avatar + Name Section */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            mb: 4,
          }}
        >
          {/* Large Circular Avatar */}
          <Skeleton
            variant="circular"
            width={100}
            height={100}
            animation="wave"
            sx={{ mb: 2 }}
          />

          {/* Name */}
          <Skeleton
            variant="text"
            width={180}
            height={32}
            animation="wave"
            sx={{ mb: 0.5 }}
          />

          {/* Email */}
          <Skeleton
            variant="text"
            width={220}
            height={22}
            animation="wave"
            sx={{ mb: 1 }}
          />

          {/* Role Chip */}
          <Skeleton
            variant="rectangular"
            width={80}
            height={28}
            animation="wave"
            sx={{ borderRadius: 14 }}
          />
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Info Rows */}
        {[
          { labelWidth: 100, valueWidth: '60%' },
          { labelWidth: 80, valueWidth: '70%' },
          { labelWidth: 110, valueWidth: '55%' },
          { labelWidth: 90, valueWidth: '65%' },
          { labelWidth: 70, valueWidth: '50%' },
          { labelWidth: 120, valueWidth: '60%' },
        ].map((row, index) => (
          <Box key={index}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                py: 1.5,
                px: 1,
              }}
            >
              <Skeleton
                variant="circular"
                width={32}
                height={32}
                animation="wave"
                sx={{ mr: 2, flexShrink: 0 }}
              />
              <Box sx={{ flex: 1 }}>
                <Skeleton
                  variant="text"
                  width={row.labelWidth}
                  height={16}
                  animation="wave"
                  sx={{ mb: 0.5 }}
                />
                <Skeleton
                  variant="text"
                  width={row.valueWidth}
                  height={22}
                  animation="wave"
                />
              </Box>
            </Box>
            {index < 5 && <Divider sx={{ ml: 7 }} />}
          </Box>
        ))}
      </CardContent>
    </Card>
  );
}
