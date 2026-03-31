import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Alert,
  CircularProgress,
  Card,
  CardContent
} from '@mui/material';
import {
  MyLocation,
  Business,
  CheckCircle,
  Warning,
  Error as ErrorIcon
} from '@mui/icons-material';
import { GoogleMap, Marker, Circle, useLoadScript } from '@react-google-maps/api';

const libraries = ['places'];

/**
 * CheckInPreviewMap Component
 *
 * Shows BEFORE check-in to help user know:
 * - Their current location
 * - Office location with radius circle
 * - Whether they're within valid check-in range
 * - Live distance calculation
 *
 * @param {Object} props
 * @param {Object} props.companyLocation - Office location { latitude, longitude }
 * @param {number} props.validRadius - Valid check-in radius in meters (default 500m)
 */
function CheckInPreviewMap({ companyLocation, validRadius = 500 }) {
  const [userLocation, setUserLocation] = useState(null);
  const [distance, setDistance] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [isWithinRange, setIsWithinRange] = useState(false);

  // Load Google Maps script
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_PLACES_API_KEY,
    libraries,
  });

  // Get user's current location
  useEffect(() => {
    if (!companyLocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;

        setUserLocation({
          latitude: userLat,
          longitude: userLng,
          accuracy: position.coords.accuracy
        });

        // Calculate distance using Haversine formula
        const calculatedDistance = calculateDistance(
          userLat,
          userLng,
          companyLocation.latitude,
          companyLocation.longitude
        );

        setDistance(calculatedDistance);
        setIsWithinRange(calculatedDistance * 1000 <= validRadius); // Convert km to meters
        setLocationError('');
      },
      (error) => {
        console.error('Error getting location:', error);
        setLocationError('Unable to get your location. Please enable GPS.');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [companyLocation, validRadius]);

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
  };

  // Calculate map center (midpoint or office location)
  const mapCenter = useMemo(() => {
    if (!companyLocation) {
      return { lat: 3.139, lng: 101.6869 }; // Default: KL
    }

    if (userLocation) {
      return {
        lat: (userLocation.latitude + companyLocation.latitude) / 2,
        lng: (userLocation.longitude + companyLocation.longitude) / 2
      };
    }

    return {
      lat: companyLocation.latitude,
      lng: companyLocation.longitude
    };
  }, [userLocation, companyLocation]);

  // Calculate zoom level based on distance
  const mapZoom = useMemo(() => {
    if (!distance) return 15;

    if (distance < 0.1) return 17; // < 100m
    if (distance < 0.5) return 16; // < 500m
    if (distance < 1) return 15;   // < 1km
    if (distance < 2) return 14;   // < 2km
    return 13;
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
    fullscreenControl: true
  };

  // Circle options for valid radius
  const circleOptions = {
    strokeColor: isWithinRange ? '#4CAF50' : '#FF9800',
    strokeOpacity: 0.8,
    strokeWeight: 2,
    fillColor: isWithinRange ? '#4CAF50' : '#FF9800',
    fillOpacity: 0.15,
    clickable: false,
    draggable: false,
    editable: false,
    visible: true,
    radius: validRadius, // in meters
    zIndex: 1
  };

  if (loadError) {
    return (
      <Alert severity="error">
        Failed to load map. Please check your internet connection.
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

  if (!companyLocation) {
    return (
      <Alert severity="info">
        Office location not configured. Please contact your administrator.
      </Alert>
    );
  }

  return (
    <Box>
      {/* Status Alert */}
      {locationError ? (
        <Alert severity="error" sx={{ mb: 2 }} icon={<ErrorIcon />}>
          {locationError}
        </Alert>
      ) : userLocation ? (
        <Alert
          severity={isWithinRange ? 'success' : 'warning'}
          sx={{ mb: 2 }}
          icon={isWithinRange ? <CheckCircle /> : <Warning />}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {isWithinRange
              ? `✓ You're within check-in range (${distance?.toFixed(2)} km from office)`
              : `⚠ You're outside check-in range (${distance?.toFixed(2)} km from office)`
            }
          </Typography>
          <Typography variant="caption">
            Valid radius: {validRadius}m ({(validRadius/1000).toFixed(2)} km)
          </Typography>
        </Alert>
      ) : (
        <Alert severity="info" sx={{ mb: 2 }}>
          <CircularProgress size={16} sx={{ mr: 1 }} />
          Getting your location...
        </Alert>
      )}

      {/* Location Info Cards */}
      {userLocation && (
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <Card sx={{ flex: 1, minWidth: 200, bgcolor: 'error.50', border: '1px solid', borderColor: 'error.main' }}>
            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                <MyLocation sx={{ color: 'error.main', fontSize: 18, mr: 0.5 }} />
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'error.main' }}>
                  Your Location
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {userLocation.latitude.toFixed(6)}, {userLocation.longitude.toFixed(6)}
              </Typography>
              <Chip
                label={`±${Math.round(userLocation.accuracy)}m`}
                size="small"
                color="error"
                sx={{ mt: 0.5, height: 20, fontSize: '0.7rem' }}
              />
            </CardContent>
          </Card>

          <Card sx={{ flex: 1, minWidth: 200, bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.main' }}>
            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                <Business sx={{ color: 'primary.main', fontSize: 18, mr: 0.5 }} />
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main' }}>
                  Office Location
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {companyLocation.latitude.toFixed(6)}, {companyLocation.longitude.toFixed(6)}
              </Typography>
              <Chip
                label={`Radius: ${validRadius}m`}
                size="small"
                color="primary"
                sx={{ mt: 0.5, height: 20, fontSize: '0.7rem' }}
              />
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Google Map with Circle Radius */}
      <Paper
        elevation={3}
        sx={{
          overflow: 'hidden',
          borderRadius: 3,
          border: '2px solid',
          borderColor: isWithinRange ? 'success.main' : 'warning.main'
        }}
      >
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={mapCenter}
          zoom={mapZoom}
          options={mapOptions}
        >
          {/* Office Location Marker (Blue) */}
          <Marker
            position={{ lat: companyLocation.latitude, lng: companyLocation.longitude }}
            icon={{
              url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
              scaledSize: new window.google.maps.Size(40, 40)
            }}
            title="Office Location"
          />

          {/* Valid Radius Circle */}
          <Circle
            center={{ lat: companyLocation.latitude, lng: companyLocation.longitude }}
            options={circleOptions}
          />

          {/* User Location Marker (Red) - Only show if we have user location */}
          {userLocation && (
            <Marker
              position={{ lat: userLocation.latitude, lng: userLocation.longitude }}
              icon={{
                url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
                scaledSize: new window.google.maps.Size(40, 40)
              }}
              title="Your Location"
              animation={window.google.maps.Animation.BOUNCE}
            />
          )}
        </GoogleMap>
      </Paper>

      {/* Map Legend */}
      <Box sx={{ display: 'flex', gap: 2, mt: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Box sx={{ width: 12, height: 12, bgcolor: '#EA4335', borderRadius: '50%', mr: 1 }} />
          <Typography variant="caption" color="text.secondary">Your Location (Live)</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Box sx={{ width: 12, height: 12, bgcolor: '#4285F4', borderRadius: '50%', mr: 1 }} />
          <Typography variant="caption" color="text.secondary">Office Location</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Box sx={{ width: 24, height: 12, bgcolor: isWithinRange ? '#4CAF50' : '#FF9800', opacity: 0.3, borderRadius: 1, mr: 1 }} />
          <Typography variant="caption" color="text.secondary">
            Valid Check-in Area ({validRadius}m radius)
          </Typography>
        </Box>
      </Box>

      {/* Helper Text */}
      <Alert severity="info" sx={{ mt: 2 }}>
        <Typography variant="caption">
          <strong>Note:</strong> The circle shows the valid check-in area. Your location will update in real-time.
          {isWithinRange
            ? ' You can check in now!'
            : ' Please move closer to the office to check in.'
          }
        </Typography>
      </Alert>
    </Box>
  );
}

export default CheckInPreviewMap;
