module.exports = {
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      if (env === 'development') {
        // Suppress performance warnings
        webpackConfig.performance = {
          hints: false,
        };
        
        // Reduce webpack noise in console
        webpackConfig.infrastructureLogging = {
          level: 'error',
        };
      }
      
      return webpackConfig;
    },
  },
};