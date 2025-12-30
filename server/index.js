import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001; // Changed from 5000 to avoid AirPlay conflict on macOS

// Trust proxy to get real IP addresses
app.set('trust proxy', true);

// Middleware - CORS configuration
// Allow localhost for development and Vercel domains for production
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  // Add your Vercel domains here after deployment
  process.env.WEBSITE_URL,
  process.env.ADMIN_URL
].filter(Boolean); // Remove undefined values

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list
    if (allowedOrigins.indexOf(origin) !== -1 || 
        origin.includes('.vercel.app') || // Allow all Vercel preview deployments
        origin.includes('localhost')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Handle preflight requests
app.options('*', cors());

app.use(express.json());

// In-memory storage for IP addresses (in production, use a database)
let ipAddresses = [];

// Function to get IP geolocation and ISP info
async function getIPInfo(ip) {
  // Skip geolocation lookup only if IP is truly invalid or null
  if (!ip || ip === '127.0.0.1' || ip === '::1') {
    // Still try to get location even for localhost by using a service that detects public IP
    // But if that fails, return Unknown instead of "Local"
    try {
      // Try to get location using ip-api.com with empty query (gets requester's IP)
      const response = await fetch(`http://ip-api.com/json/?fields=status,message,country,regionName,city,lat,lon,isp,org,as,proxy,hosting,query`);
      const data = await response.json();
      
      if (data.status === 'success') {
        // Enhanced VPN/Proxy detection for localhost fallback
        const isHosting = data.hosting === true;
        const isProxy = data.proxy === true;
        const fakeIPIndicators = [];
        
        const ispLower = (data.isp || '').toLowerCase();
        const orgLower = (data.org || '').toLowerCase();
        const vpnKeywords = ['vpn', 'proxy', 'hosting', 'datacenter', 'server', 'cloud', 'aws', 'azure', 'google cloud', 'digitalocean', 'linode', 'vultr', 'ovh'];
        
        vpnKeywords.forEach(keyword => {
          if (ispLower.includes(keyword) || orgLower.includes(keyword)) {
            fakeIPIndicators.push(`ISP/Org contains "${keyword}"`);
          }
        });
        
        return {
          country: data.country || 'Unknown',
          city: data.city || 'Unknown',
          region: data.regionName || 'Unknown',
          isp: data.isp || 'Unknown',
          organization: data.org || 'Unknown',
          asn: data.as || 'Unknown',
          isVPN: isHosting || fakeIPIndicators.length > 0,
          isProxy: isProxy,
          fakeIPIndicators: fakeIPIndicators,
          latitude: data.lat || null,
          longitude: data.lon || null
        };
      }
    } catch (error) {
      console.error('Error fetching location for localhost:', error);
    }
    
    // Return Unknown instead of "Local"
    return {
      country: 'Unknown',
      city: 'Unknown',
      region: 'Unknown',
      isp: 'Unknown',
      isVPN: false,
      isProxy: false,
      fakeIPIndicators: [],
      latitude: null,
      longitude: null
    };
  }

  try {
    // Using ip-api.com (free, no API key required)
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,regionName,city,lat,lon,isp,org,as,proxy,hosting,query`);
    const data = await response.json();
    
    if (data.status === 'success') {
      // Enhanced VPN/Proxy detection with fake IP indicators
      const isHosting = data.hosting === true;
      const isProxy = data.proxy === true;
      
      // Check for fake IP indicators
      const fakeIPIndicators = [];
      
      // Check if ISP is a known VPN/Proxy provider
      const ispLower = (data.isp || '').toLowerCase();
      const orgLower = (data.org || '').toLowerCase();
      const vpnKeywords = ['vpn', 'proxy', 'hosting', 'datacenter', 'server', 'cloud', 'aws', 'azure', 'google cloud', 'digitalocean', 'linode', 'vultr', 'ovh'];
      
      vpnKeywords.forEach(keyword => {
        if (ispLower.includes(keyword) || orgLower.includes(keyword)) {
          fakeIPIndicators.push(`ISP/Org contains "${keyword}"`);
        }
      });
      
      // Check if ASN is from datacenter/hosting
      if (data.as) {
        const asnLower = data.as.toLowerCase();
        if (asnLower.includes('hosting') || asnLower.includes('datacenter') || asnLower.includes('server')) {
          fakeIPIndicators.push('ASN indicates hosting/datacenter');
        }
      }
      
      // Check for suspicious organization names
      const suspiciousOrgs = ['amazon', 'microsoft', 'google', 'cloudflare', 'fastly', 'akamai'];
      suspiciousOrgs.forEach(org => {
        if (orgLower.includes(org) && !orgLower.includes('internet')) {
          fakeIPIndicators.push(`Organization: ${org} (likely cloud/VPN)`);
        }
      });
      
      return {
        country: data.country || 'Unknown',
        city: data.city || 'Unknown',
        region: data.regionName || 'Unknown',
        isp: data.isp || 'Unknown',
        organization: data.org || 'Unknown',
        asn: data.as || 'Unknown',
        isVPN: isHosting || fakeIPIndicators.length > 0,
        isProxy: isProxy,
        fakeIPIndicators: fakeIPIndicators,
        latitude: data.lat || null,
        longitude: data.lon || null
      };
    }
  } catch (error) {
    console.error('Error fetching IP info:', error);
  }

  return {
    country: 'Unknown',
    city: 'Unknown',
    region: 'Unknown',
    isp: 'Unknown',
    isVPN: false,
    isProxy: false,
    fakeIPIndicators: [],
    latitude: null,
    longitude: null
  };
}

// Route to track IP address
app.post('/api/track-ip', async (req, res) => {
  try {
    // Get IP address from request - try multiple methods
    let ip = req.ip || 
             req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
             req.headers['x-real-ip'] || 
             req.connection?.remoteAddress || 
             req.socket?.remoteAddress ||
             req.headers['cf-connecting-ip'] ||
             '127.0.0.1';
    
    // Remove IPv6 prefix if present
    ip = ip.replace('::ffff:', '').replace('::1', '127.0.0.1');
    
    // If still localhost, try to get from forwarded headers
    if (ip === '127.0.0.1' || ip === '::1' || !ip) {
      ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
           req.headers['x-real-ip'] || 
           '127.0.0.1';
    }
    
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const timestamp = new Date().toISOString();
    const now = Date.now();
    
    // Use public IP from client if available, otherwise use server-detected IP
    const publicIP = req.body.publicIP || ip;
    const ipForLocation = publicIP;
    
    // Get IP geolocation and ISP info using the public IP
    const ipInfo = await getIPInfo(ipForLocation);
    
    // Get device info from request body
    const deviceInfo = req.body.deviceInfo || {};
    
    // Get behavioral data
    const referrer = req.body.referrer || 'Direct Visit';
    const entryTime = req.body.entryTime || now;
    
    // Generate or get Unique Visitor ID
    // Create a fingerprint-based ID
    const fingerprint = `${userAgent}-${deviceInfo.screenResolution}-${deviceInfo.language}-${deviceInfo.timezone}`;
    const fingerprintHash = Buffer.from(fingerprint).toString('base64').substring(0, 16);
    const uniqueVisitorID = `VIS-${Date.now().toString(36)}-${fingerprintHash}`.toUpperCase();
    
    // Check if this visitor ID already exists
    const existingVisitor = ipAddresses.find(item => item.uniqueVisitorID === uniqueVisitorID);
    const visitCount = existingVisitor ? existingVisitor.visitCount + 1 : 1;
    
    const ipData = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9), // Unique ID
      uniqueVisitorID: uniqueVisitorID, // Unique Visitor ID
      ip: ip, // Server-detected IP
      publicIP: publicIP, // User's public IP address
      userAgent,
      timestamp,
      page: req.body.page || 'Product Sale Website',
      visitCount: visitCount,
      entryTime: entryTime, // When user entered the site
      referrer: referrer, // Where user came from
      
      // Device Info - Store full deviceInfo object to preserve all fields
      deviceInfo: {
        ...deviceInfo, // Store all deviceInfo fields (gpu, ram, webrtc, sensors, etc.)
        // Ensure these basic fields are always present
        screenResolution: deviceInfo.screenResolution || 'Unknown',
        browser: deviceInfo.browser || 'Unknown',
        browserVersion: deviceInfo.browserVersion || 'Unknown',
        os: deviceInfo.os || 'Unknown',
        osVersion: deviceInfo.osVersion || 'Unknown',
        deviceType: deviceInfo.deviceType || 'Unknown',
        deviceModel: deviceInfo.deviceModel || 'Unknown',
        isMobile: deviceInfo.isMobile || false,
        isTablet: deviceInfo.isTablet || false,
        language: deviceInfo.language || 'Unknown',
        batteryLevel: deviceInfo.batteryLevel,
        batteryCharging: deviceInfo.batteryCharging,
        connectionType: deviceInfo.connectionType || 'Unknown',
        connectionEffectiveType: deviceInfo.connectionEffectiveType || 'Unknown',
        timezone: deviceInfo.timezone || 'Unknown',
        viewportWidth: deviceInfo.viewportWidth || 'Unknown',
        viewportHeight: deviceInfo.viewportHeight || 'Unknown',
      },
      
      // IP Geolocation Info
      location: {
        country: ipInfo.country,
        city: ipInfo.city,
        region: ipInfo.region,
        latitude: ipInfo.latitude,
        longitude: ipInfo.longitude
      },
      
      // Network Info
      network: {
        isp: ipInfo.isp,
        organization: ipInfo.organization,
        asn: ipInfo.asn,
        isVPN: ipInfo.isVPN,
        isProxy: ipInfo.isProxy,
        fakeIPIndicators: ipInfo.fakeIPIndicators || []
      }
    };
    
    ipAddresses.push(ipData);
    
    console.log('✅ IP tracked:', {
      ip: ipData.ip,
      visitCount: ipData.visitCount,
      location: `${ipData.location.city}, ${ipData.location.country}`,
      device: `${ipData.deviceInfo.deviceType} - ${ipData.deviceInfo.os}`
    });
    console.log('📊 Total IPs stored:', ipAddresses.length);
    
    res.json({ success: true, message: 'IP tracked successfully', ip: ip, visitCount: visitCount });
  } catch (error) {
    console.error('❌ Error tracking IP:', error);
    res.status(500).json({ success: false, error: 'Failed to track IP' });
  }
});

// Route to get all IP addresses (for admin panel)
app.get('/api/ips', (req, res) => {
  try {
    console.log('📥 Admin panel requested IPs. Total:', ipAddresses.length);
    res.json({ success: true, data: ipAddresses });
  } catch (error) {
    console.error('❌ Error fetching IPs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch IPs' });
  }
});

// Route to get IP statistics
app.get('/api/ip-stats', (req, res) => {
  try {
    const uniqueIPs = new Set(ipAddresses.map(item => item.ip));
    
    // Group by IP to get visit counts
    const ipVisitCounts = {};
    ipAddresses.forEach(item => {
      if (!ipVisitCounts[item.ip]) {
        ipVisitCounts[item.ip] = 0;
      }
      ipVisitCounts[item.ip]++;
    });
    
    const stats = {
      total: ipAddresses.length,
      unique: uniqueIPs.size,
      recent: ipAddresses.slice(-10).reverse(),
      visitCounts: ipVisitCounts
    };
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Server is running',
    totalIPs: ipAddresses.length 
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Ready to track IP addresses`);
  console.log(`🔗 API endpoints:`);
  console.log(`   - POST /api/track-ip`);
  console.log(`   - GET  /api/ips`);
  console.log(`   - GET  /api/ip-stats`);
  console.log(`   - GET  /api/health`);
});

