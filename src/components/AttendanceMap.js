import React, { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Grid
} from '@mui/material';
import {
  LocationOn,
  Business,
  Timeline,
  MyLocation
} from '@mui/icons-material';
import { GoogleMap, Marker, Polyline, InfoWindow, useLoadScript } from '@react-google-maps/api';

const libraries = ['places'];

/**
 * AttendanceMap Component
 *
 * Displays a Google Map showing:
 * - User's check-in location (red marker)
 * - Company office location (blue marker)
 * - Distance line between the two locations
 * - Info windows with location details
 *
 * @param {Object} props
 * @param {Object} props.userLocation - User's location { latitude, longitude, accuracy, method }
 * @param {Object} props.companyLocation - Company's location { latitude, longitude, name, address }
 * @param {number} props.distance - Distance in kilometers between locations
 */
function AttendanceMap({ userLocation, companyLocation, distance }) {
  const [selectedMarker, setSelectedMarker] = useState(null);

  // Load Google Maps script
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_PLACES_API_KEY,
    libraries,
  });

  // Calculate map center (midpoint between user and office)
  const mapCenter = useMemo(() => {
    if (!userLocation || !companyLocation) {
      return { lat: 3.139, lng: 101.6869 }; // Default: Kuala Lumpur
    }

    return {
      lat: (userLocation.latitude + companyLocation.latitude) / 2,
      lng: (userLocation.longitude + companyLocation.longitude) / 2
    };
  }, [userLocation, companyLocation]);

  // Calculate appropriate zoom level based on distance
  const mapZoom = useMemo(() => {
    if (!distance) return 15;

    // Adjust zoom based on distance
    if (distance < 0.5) return 16; // < 500m
    if (distance < 1) return 15;   // < 1km
    if (distance < 2) return 14;   // < 2km
    if (distance < 5) return 13;   // < 5km
    if (distance < 10) return 12;  // < 10km
    return 11; // > 10km
  }, [distance]);

  const mapContainerStyle = {
    width: '100%',
    height: '400px',
    borderRadius: '12px'
  };

  const mapOptions = {
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: false,
    scaleControl: true,
    streetViewControl: false,
    rotateControl: false,
    fullscreenControl: true,
    styles: [
      {
        featureType: 'poi',
        elementType: 'labels',
        stylers: [{ visibility: 'off' }]
      }
    ]
  };

  // Path for the line between locations
  const linePath = useMemo(() => {
    if (!userLocation || !companyLocation) return [];

    return [
      { lat: userLocation.latitude, lng: userLocation.longitude },
      { lat: companyLocation.latitude, lng: companyLocation.longitude }
    ];
  }, [userLocation, companyLocation]);

  const lineOptions = {
    strokeColor: '#1976d2',
    strokeOpacity: 0.8,
    strokeWeight: 3,
    geodesic: true
  };

  // Get location quality color
  const getLocationQualityColor = (accuracy) => {
    if (!accuracy) return 'default';
    if (accuracy <= 50) return 'success';
    if (accuracy <= 100) return 'success';
    if (accuracy <= 500) return 'warning';
    return 'error';
  };

  const getLocationQualityLabel = (accuracy) => {
    if (!accuracy) return 'Unknown';
    if (accuracy <= 50) return 'Excellent';
    if (accuracy <= 100) return 'Good';
    if (accuracy <= 500) return 'Fair';
    return 'Poor';
  };

  if (loadError) {
    return (
      <Alert severity="error">
        Failed to load Google Maps. Please check your internet connection and API key.
      </Alert>
    );
  }

  if (!isLoaded) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <CircularProgress size={40} />
        <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
          Loading map...
        </Typography>
      </Box>
    );
  }

  if (!userLocation || !companyLocation) {
    return (
      <Alert severity="info">
        Location data will be available after check-in.
      </Alert>
    );
  }

  return (
    <Box>
      {/* Location Info Cards */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              bgcolor: 'error.50',
              border: '2px solid',
              borderColor: 'error.main',
              borderRadius: 2
            }}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <MyLocation sx={{ color: 'error.main', mr: 1 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'error.main' }}>
                  Your Location
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                {userLocation.latitude.toFixed(6)}, {userLocation.longitude.toFixed(6)}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Chip
                  label={`±${userLocation.accuracy?.toFixed(0)}m`}
                  size="small"
                  color={getLocationQualityColor(userLocation.accuracy)}
                  sx={{ fontSize: '0.75rem', height: 24 }}
                />
                <Chip
                  label={getLocationQualityLabel(userLocation.accuracy)}
                  size="small"
                  color={getLocationQualityColor(userLocation.accuracy)}
                  sx={{ fontSize: '0.75rem', height: 24 }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card
            sx={{
              bgcolor: 'primary.50',
              border: '2px solid',
              borderColor: 'primary.main',
              borderRadius: 2
            }}
          >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Business sx={{ color: 'primary.main', mr: 1 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                  Office Location
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                {companyLocation.name || 'Company Office'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                {companyLocation.latitude.toFixed(6)}, {companyLocation.longitude.toFixed(6)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Distance Info */}
      {distance !== null && distance !== undefined && (
        <Paper
          sx={{
            p: 2,
            mb: 2,
            bgcolor: 'success.50',
            border: '1px solid',
            borderColor: 'success.main',
            borderRadius: 2
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Timeline sx={{ color: 'success.main', mr: 1 }} />
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'success.main' }}>
                Distance from Office
              </Typography>
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'success.main' }}>
              {distance.toFixed(2)} km
            </Typography>
          </Box>
        </Paper>
      )}

      {/* Google Map */}
      <Paper
        elevation={3}
        sx={{
          overflow: 'hidden',
          borderRadius: 3,
          border: '2px solid',
          borderColor: 'divider'
        }}
      >
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={mapCenter}
          zoom={mapZoom}
          options={mapOptions}
        >
          {/* User Location Marker (Red) */}
          <Marker
            position={{ lat: userLocation.latitude, lng: userLocation.longitude }}
            icon={{
              url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
              scaledSize: new window.google.maps.Size(40, 40)
            }}
            title="Your Location"
            onClick={() => setSelectedMarker('user')}
          />

          {/* Company Location Marker (Blue) */}
          <Marker
            position={{ lat: companyLocation.latitude, lng: companyLocation.longitude }}
            icon={{
              url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
              scaledSize: new window.google.maps.Size(40, 40)
            }}
            title="Office Location"
            onClick={() => setSelectedMarker('office')}
          />

          {/* Line connecting the two locations */}
          <Polyline
            path={linePath}
            options={lineOptions}
          />

          {/* Info Window for User Location */}
          {selectedMarker === 'user' && (
            <InfoWindow
              position={{ lat: userLocation.latitude, lng: userLocation.longitude }}
              onCloseClick={() => setSelectedMarker(null)}
            >
              <Box sx={{ p: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'error.main', mb: 0.5 }}>
                  Your Check-in Location
                </Typography>
                <Typography variant="caption" sx={{ display: 'block' }}>
                  Lat: {userLocation.latitude.toFixed(6)}
                </Typography>
                <Typography variant="caption" sx={{ display: 'block' }}>
                  Lng: {userLocation.longitude.toFixed(6)}
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                  Accuracy: ±{userLocation.accuracy?.toFixed(0)}m
                </Typography>
                {userLocation.method && (
                  <Typography variant="caption" sx={{ display: 'block' }}>
                    Method: {userLocation.method}
                  </Typography>
                )}
              </Box>
            </InfoWindow>
          )}

          {/* Info Window for Office Location */}
          {selectedMarker === 'office' && (
            <InfoWindow
              position={{ lat: companyLocation.latitude, lng: companyLocation.longitude }}
              onCloseClick={() => setSelectedMarker(null)}
            >
              <Box sx={{ p: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'primary.main', mb: 0.5 }}>
                  {companyLocation.name || 'Office Location'}
                </Typography>
                {companyLocation.address && (
                  <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                    {companyLocation.address.line1}
                  </Typography>
                )}
                <Typography variant="caption" sx={{ display: 'block' }}>
                  Lat: {companyLocation.latitude.toFixed(6)}
                </Typography>
                <Typography variant="caption" sx={{ display: 'block' }}>
                  Lng: {companyLocation.longitude.toFixed(6)}
                </Typography>
              </Box>
            </InfoWindow>
          )}
        </GoogleMap>
      </Paper>

      {/* Map Legend */}
      <Box sx={{ display: 'flex', gap: 2, mt: 2, justifyContent: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Box
            sx={{
              width: 12,
              height: 12,
              bgcolor: '#EA4335',
              borderRadius: '50%',
              mr: 1
            }}
          />
          <Typography variant="caption" color="text.secondary">
            Your Location
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Box
            sx={{
              width: 12,
              height: 12,
              bgcolor: '#4285F4',
              borderRadius: '50%',
              mr: 1
            }}
          />
          <Typography variant="caption" color="text.secondary">
            Office Location
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Box
            sx={{
              width: 24,
              height: 2,
              bgcolor: '#1976d2',
              mr: 1
            }}
          />
          <Typography variant="caption" color="text.secondary">
            Distance
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

export default AttendanceMap;
