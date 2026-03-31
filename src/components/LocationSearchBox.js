import React, { useState, useRef, useEffect } from 'react';
import {
  TextField,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Box,
  Typography,
  Chip,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  LocationOn,
  Business,
  Star,
  Phone,
  Language,
  Schedule
} from '@mui/icons-material';
import { useLoadScript } from '@react-google-maps/api';

const libraries = ['places'];

/**
 * LocationSearchBox Component
 *
 * A Google Places Autocomplete search box that allows users to search for
 * business locations and get detailed information including:
 * - Business name
 * - Full address
 * - Coordinates (latitude, longitude)
 * - Phone number
 * - Website
 * - Rating and reviews
 * - Business hours
 *
 * Usage:
 * <LocationSearchBox
 *   onPlaceSelected={(place) => {
 *     console.log('Selected place:', place);
 *     // place contains: name, address, coordinates, phone, website, etc.
 *   }}
 *   placeholder="Search for your office location..."
 * />
 */
function LocationSearchBox({ onPlaceSelected, placeholder = "Search for office location...", defaultValue = "" }) {
  const [searchValue, setSearchValue] = useState(defaultValue);
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const autocompleteService = useRef(null);
  const placesService = useRef(null);
  const searchInputRef = useRef(null);

  // Load Google Maps script
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_PLACES_API_KEY,
    libraries,
  });

  // Initialize Google Places services
  useEffect(() => {
    if (isLoaded && window.google) {
      autocompleteService.current = new window.google.maps.places.AutocompleteService();
      // Create a hidden div for PlacesService (it requires a map or div element)
      const div = document.createElement('div');
      placesService.current = new window.google.maps.places.PlacesService(div);
    }
  }, [isLoaded]);

  // Handle search input change
  const handleSearchChange = (event) => {
    const value = event.target.value;
    setSearchValue(value);
    setError('');

    if (value.length < 3) {
      setPredictions([]);
      return;
    }

    if (!autocompleteService.current) {
      setError('Google Places service not loaded');
      return;
    }

    setLoading(true);

    // Get place predictions
    autocompleteService.current.getPlacePredictions(
      {
        input: value,
        types: ['establishment', 'geocode'], // Search for businesses and addresses
      },
      (predictions, status) => {
        setLoading(false);

        if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
          setPredictions(predictions);
        } else if (status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          setPredictions([]);
        } else {
          console.error('Places prediction error:', status);
          setError('Failed to search locations. Please try again.');
        }
      }
    );
  };

  // Handle place selection
  const handlePlaceSelect = (placeId) => {
    if (!placesService.current) {
      setError('Places service not available');
      return;
    }

    setLoading(true);

    // Get detailed place information
    placesService.current.getDetails(
      {
        placeId: placeId,
        fields: [
          'name',
          'formatted_address',
          'geometry',
          'formatted_phone_number',
          'international_phone_number',
          'website',
          'rating',
          'user_ratings_total',
          'opening_hours',
          'address_components',
          'place_id',
          'types'
        ]
      },
      (place, status) => {
        setLoading(false);

        if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
          // Extract address components
          const addressComponents = {};
          if (place.address_components) {
            place.address_components.forEach(component => {
              const type = component.types[0];
              addressComponents[type] = component.long_name;
            });
          }

          // Build street address (without city, state, postcode)
          let streetAddress = '';
          const streetNumber = addressComponents.street_number || '';
          const route = addressComponents.route || '';
          const subpremise = addressComponents.subpremise || ''; // Unit number
          const premise = addressComponents.premise || ''; // Building name

          // Combine street components
          if (subpremise) streetAddress += subpremise;
          if (premise) streetAddress += (streetAddress ? ', ' : '') + premise;
          if (streetNumber || route) {
            const streetPart = [streetNumber, route].filter(Boolean).join(' ');
            streetAddress += (streetAddress ? ', ' : '') + streetPart;
          }

          // If we couldn't build a street address, use the full formatted address as fallback
          if (!streetAddress) {
            streetAddress = place.formatted_address;
          }

          // Format the place data
          const placeData = {
            name: place.name,
            address: place.formatted_address,
            streetAddress: streetAddress, // Street address without city/state/postcode
            latitude: place.geometry.location.lat(),
            longitude: place.geometry.location.lng(),
            phone: place.formatted_phone_number || place.international_phone_number || '',
            website: place.website || '',
            rating: place.rating || 0,
            totalReviews: place.user_ratings_total || 0,
            placeId: place.place_id,
            types: place.types || [],
            isOpenNow: place.opening_hours?.isOpen?.() || null,
            // Address components
            addressComponents: {
              streetNumber: streetNumber,
              route: route,
              subpremise: subpremise,
              premise: premise,
              street: addressComponents.route || '',
              city: addressComponents.locality || addressComponents.administrative_area_level_2 || '',
              state: addressComponents.administrative_area_level_1 || '',
              country: addressComponents.country || '',
              postalCode: addressComponents.postal_code || '',
            }
          };

          setSearchValue(place.name);
          setPredictions([]);

          // Call the callback with place data
          if (onPlaceSelected) {
            onPlaceSelected(placeData);
          }
        } else {
          console.error('Place details error:', status);
          setError('Failed to get place details. Please try again.');
        }
      }
    );
  };

  // Handle loading and error states
  if (loadError) {
    return (
      <Alert severity="error">
        Failed to load Google Maps. Please check your API key.
      </Alert>
    );
  }

  if (!isLoaded) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CircularProgress size={20} />
        <Typography variant="body2" color="text.secondary">
          Loading location search...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative', width: '100%' }}>
      <TextField
        fullWidth
        label="Office Location"
        placeholder={placeholder}
        value={searchValue}
        onChange={handleSearchChange}
        inputRef={searchInputRef}
        InputProps={{
          startAdornment: <LocationOn sx={{ mr: 1, color: 'action.active' }} />,
          endAdornment: loading && <CircularProgress size={20} />
        }}
        helperText="Search for your office/company location (e.g., 'Petronas Twin Towers')"
        error={!!error}
      />

      {error && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}

      {/* Predictions dropdown */}
      {predictions.length > 0 && (
        <Paper
          elevation={3}
          sx={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1000,
            mt: 0.5,
            maxHeight: 400,
            overflow: 'auto',
            borderRadius: 2
          }}
        >
          <List sx={{ p: 0 }}>
            {predictions.map((prediction, index) => (
              <ListItem
                key={prediction.place_id}
                button
                onClick={() => handlePlaceSelect(prediction.place_id)}
                sx={{
                  borderBottom: index < predictions.length - 1 ? '1px solid' : 'none',
                  borderColor: 'divider',
                  '&:hover': {
                    bgcolor: 'action.hover'
                  }
                }}
              >
                <ListItemIcon>
                  <Business color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {prediction.structured_formatting.main_text}
                    </Typography>
                  }
                  secondary={
                    <Typography variant="body2" color="text.secondary">
                      {prediction.structured_formatting.secondary_text}
                    </Typography>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}
    </Box>
  );
}

export default LocationSearchBox;
