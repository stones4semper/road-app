import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import * as Location from 'expo-location';
import { Magnetometer } from 'expo-sensors';
import * as Haptics from 'expo-haptics';
import { MaterialIcons } from '@expo/vector-icons';
import { GOOGLE_MAPS_API_KEY } from '@env';

const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.0922;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;
const GOOGLE_PLACES_API_KEY = GOOGLE_MAPS_API_KEY;

export default function App() {
	const [origin, setOrigin] = useState(null);
	const [destination, setDestination] = useState(null);
	const [coordinates, setCoordinates] = useState([]);
	const [distance, setDistance] = useState(0);
	const [duration, setDuration] = useState(0);
	const [heading, setHeading] = useState(0);
	const [userLocation, setUserLocation] = useState(null);
	const [subscription, setSubscription] = useState(null);
	const mapRef = useRef(null);
	const compassRef = useRef(null);

	useEffect(() => {
		(async () => {
			let { status } = await Location.requestForegroundPermissionsAsync();
			if (status !== 'granted') {
				console.error('Permission to access location was denied');
				return;
			}

			let location = await Location.getCurrentPositionAsync({});
			setUserLocation({
				latitude: location.coords.latitude,
				longitude: location.coords.longitude,
				latitudeDelta: LATITUDE_DELTA,
				longitudeDelta: LONGITUDE_DELTA,
			});
			
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
		})();

		return () => {
			_unsubscribe();
		};
	}, []);

	const _subscribe = () => {
		Magnetometer.setUpdateInterval(100);
		setSubscription(
			Magnetometer.addListener((data) => {
				let angle = Math.atan2(data.y, data.x) * (180 / Math.PI);
				if (angle < 0) {
					angle += 360;
				}
				setHeading(Math.round(angle));
			})
		);
	};

	const _unsubscribe = () => {
		subscription && subscription.remove();
		setSubscription(null);
	};

	useEffect(() => {
		_subscribe();
		return () => _unsubscribe();
	}, []);

	const fetchDirections = async () => {
		if (!origin || !destination) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
			return;
		}

		try {
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		
		const response = await fetch(
			`https://maps.googleapis.com/maps/api/directions/json?origin=${origin.geometry.location.lat},${origin.geometry.location.lng}&destination=${destination.geometry.location.lat},${destination.geometry.location.lng}&key=${GOOGLE_PLACES_API_KEY}`
		);
		const data = await response.json();

		if (data.routes.length > 0) {
			const points = data.routes[0].overview_polyline.points;
			const coords = decodePolyline(points);
			setCoordinates(coords);

			setDistance(data.routes[0].legs[0].distance.text);
			setDuration(data.routes[0].legs[0].duration.text);

			mapRef.current.fitToCoordinates(coords, {
				edgePadding: { top: 100, right: 50, bottom: 50, left: 50 },
				animated: true,
			});
			
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
		}
		} catch (error) {
			console.error('Error fetching directions:', error);
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
		}
	};

	const decodePolyline = (encoded) => {
		let points = [];
		let index = 0,
		len = encoded.length;
		let lat = 0,
		lng = 0;

		while (index < len) {
		let b,
			shift = 0,
			result = 0;
		do {
			b = encoded.charCodeAt(index++) - 63;
			result |= (b & 0x1f) << shift;
			shift += 5;
		} while (b >= 0x20);
		let dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
		lat += dlat;

		shift = 0;
		result = 0;
		do {
			b = encoded.charCodeAt(index++) - 63;
			result |= (b & 0x1f) << shift;
			shift += 5;
		} while (b >= 0x20);
		let dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
		lng += dlng;

		points.push({
			latitude: lat / 1e5,
			longitude: lng / 1e5,
		});
		}

		return points;
	};

	const centerMap = () => {
		if (userLocation) {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
		mapRef.current.animateToRegion(userLocation, 1000);
		}
	};

	const handlePlaceSelect = (type, details) => {
		Haptics.selectionAsync();
		if (type === 'origin') {
		setOrigin(details);
		} else {
		setDestination(details);
		}
	};

	return (
		<View style={styles.container}>
		<MapView
			ref={mapRef}
			style={styles.map}
			initialRegion={userLocation}
			showsUserLocation={true}
			showsCompass={false}
			rotateEnabled={true}
		>
			{coordinates.length > 0 && (
			<Polyline
				coordinates={coordinates}
				strokeWidth={4}
				strokeColor="#3498db"
			/>
			)}
			{origin && (
			<Marker
				coordinate={{
				latitude: origin.geometry.location.lat,
				longitude: origin.geometry.location.lng,
				}}
				title="Origin"
				pinColor="green"
			/>
			)}
			{destination && (
			<Marker
				coordinate={{
				latitude: destination.geometry.location.lat,
				longitude: destination.geometry.location.lng,
				}}
				title="Destination"
				pinColor="red"
			/>
			)}
		</MapView>

		<View style={styles.searchContainer}>
			{Platform.OS === 'android' ? (
			<View style={{flex: 1}}>
				<GooglePlacesAutocomplete
				placeholder="From"
				minLength={2}
				fetchDetails={true}
				onPress={(data, details = null) => handlePlaceSelect('origin', details)}
				query={{
					key: GOOGLE_PLACES_API_KEY,
					language: 'en',
				}}
				enablePoweredByContainer={false}
				debounce={200}
				styles={{
					textInputContainer: {
					backgroundColor: 'white',
					},
					textInput: {
					height: 44,
					color: '#5d5d5d',
					fontSize: 16,
					backgroundColor: '#F9F9F9',
					},
				}}
				currentLocation={true}
				currentLocationLabel="Current location"
				/>
			</View>
			) : (
			<GooglePlacesAutocomplete
				placeholder="From"
				minLength={2}
				fetchDetails={true}
				onPress={(data, details = null) => handlePlaceSelect('origin', details)}
				query={{
				key: GOOGLE_PLACES_API_KEY,
				language: 'en',
				}}
				enablePoweredByContainer={false}
				debounce={200}
				styles={{
				textInputContainer: {
					backgroundColor: 'white',
				},
				textInput: {
					height: 44,
					color: '#5d5d5d',
					fontSize: 16,
					backgroundColor: '#F9F9F9',
				},
				}}
			/>
			)}

			{Platform.OS === 'android' ? (
			<View style={{flex: 1}}>
				<GooglePlacesAutocomplete
				placeholder="To"
				minLength={2}
				fetchDetails={true}
				onPress={(data, details = null) => handlePlaceSelect('destination', details)}
				query={{
					key: GOOGLE_PLACES_API_KEY,
					language: 'en',
				}}
				enablePoweredByContainer={false}
				debounce={200}
				styles={{
					textInputContainer: {
					backgroundColor: 'white',
					},
					textInput: {
					height: 44,
					color: '#5d5d5d',
					fontSize: 16,
					backgroundColor: '#F9F9F9',
					},
				}}
				/>
			</View>
			) : (
			<GooglePlacesAutocomplete
				placeholder="To"
				minLength={2}
				fetchDetails={true}
				onPress={(data, details = null) => handlePlaceSelect('destination', details)}
				query={{
				key: GOOGLE_PLACES_API_KEY,
				language: 'en',
				}}
				enablePoweredByContainer={false}
				debounce={200}
				styles={{
				textInputContainer: {
					backgroundColor: 'white',
				},
				textInput: {
					height: 44,
					color: '#5d5d5d',
					fontSize: 16,
					backgroundColor: '#F9F9F9',
				},
				}}
			/>
			)}

			<TouchableOpacity 
			style={styles.directionsButton} 
			onPress={fetchDirections}
			onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
			>
			<Text style={styles.directionsButtonText}>Get Directions</Text>
			</TouchableOpacity>

			{(distance || duration) && (
			<View style={styles.distanceContainer}>
				<Text style={styles.distanceText}>Distance: {distance}</Text>
				<Text style={styles.distanceText}>Duration: {duration}</Text>
			</View>
			)}
		</View>

		<View style={styles.compassContainer} ref={compassRef}>
			<MaterialIcons
			name="explore"
			size={40}
			color="#3498db"
			style={{
				transform: [{ rotate: `${360 - heading}deg` }],
			}}
			/>
			<Text style={styles.compassText}>{heading}°</Text>
		</View>

		<TouchableOpacity 
			style={styles.centerButton} 
			onPress={centerMap}
			onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
		>
			<MaterialIcons name="my-location" size={24} color="white" />
		</TouchableOpacity>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	map: {
		flex: 1,
	},
	searchContainer: {
		position: 'absolute',
		top: 20,
		left: 10,
		right: 10,
		backgroundColor: 'transparent',
	},
	directionsButton: {
		backgroundColor: '#3498db',
		padding: 10,
		marginHorizontal: 10,
		borderRadius: 5,
		alignItems: 'center',
		marginTop: 10,
	},
	directionsButtonText: {
		color: 'white',
		fontWeight: 'bold',
	},
	distanceContainer: {
		backgroundColor: 'white',
		padding: 10,
		marginHorizontal: 10,
		borderRadius: 5,
		marginTop: 10,
	},
	distanceText: {
		color: '#5d5d5d',
	},
	compassContainer: {
		position: 'absolute',
		bottom: 100,
		right: 20,
		backgroundColor: 'white',
		borderRadius: 25,
		padding: 10,
		alignItems: 'center',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.3,
		shadowRadius: 2,
		elevation: 5,
	},
	compassText: {
		fontSize: 12,
		marginTop: 5,
	},
	centerButton: {
		position: 'absolute',
		bottom: 40,
		right: 20,
		backgroundColor: '#3498db',
		borderRadius: 25,
		width: 50,
		height: 50,
		justifyContent: 'center',
		alignItems: 'center',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.3,
		shadowRadius: 2,
		elevation: 5,
	},
});