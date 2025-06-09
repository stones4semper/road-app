require('dotenv').config();

module.exports = ({ config }) => {
    if (!process.env.GOOGLE_MAPS_API_KEY) {
        console.warn('Warning: GOOGLE_MAPS_API_KEY environment variable is missing');
    }

    return {
        ...config,
        extra: {
        ...config.extra,
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY
        },
        ios: {
        ...config.ios,
        config: {
            ...config.ios.config,
            googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY
        }
        },
        android: {
        ...config.android,
        config: {
            ...config.android.config,
            googleMaps: {
            ...(config.android.config.googleMaps || {}),
            apiKey: process.env.GOOGLE_MAPS_API_KEY
            }
        }
        }
    };
};