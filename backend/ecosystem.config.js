module.exports = {
  apps: [
    {
      name: 'nas-home-backend',
      script: 'src/app.js',
      cwd: '/home/xuekai/project/NasHome/backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 2000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 2000
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true
    },
  ]
};
