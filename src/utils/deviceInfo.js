// Function to get user's public IP address
export const getPublicIP = async () => {
  try {
    // Try multiple free IP services
    const services = [
      'https://api.ipify.org?format=json',
      'https://ipapi.co/json/',
      'https://api.ip.sb/ip',
    ];
    
    for (const service of services) {
      try {
        const response = await fetch(service, { timeout: 3000 });
        const data = await response.json();
        
        // Handle different response formats
        if (data.ip) return data.ip;
        if (typeof data === 'string' && data.match(/^\d+\.\d+\.\d+\.\d+$/)) return data;
      } catch (e) {
        continue; // Try next service
      }
    }
  } catch (error) {
    console.error('Error fetching public IP:', error);
  }
  
  return null;
};

// Function to get local IP addresses via WebRTC IP leak
export const getWebRTCLocalIPs = async () => {
  return new Promise((resolve) => {
    const localIPs = [];
    const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/gi;
    
    // Create RTCPeerConnection to trigger ICE candidate gathering
    const RTCPeerConnection = window.RTCPeerConnection || 
                              window.mozRTCPeerConnection || 
                              window.webkitRTCPeerConnection;
    
    if (!RTCPeerConnection) {
      resolve({ localIPs: [], webrtcSupported: false });
      return;
    }
    
    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });
      
      // Create a data channel to trigger ICE gathering
      pc.createDataChannel('');
      
      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candidate = event.candidate.candidate;
          const match = candidate.match(ipRegex);
          
          if (match) {
            match.forEach(ip => {
              // Filter out public IPs and keep only local IPs
              if (ip && 
                  !ip.includes('0.0.0.0') && 
                  !ip.startsWith('127.') &&
                  !ip.startsWith('169.254.') && // Link-local
                  ip !== '::1' &&
                  !localIPs.includes(ip)) {
                // Check if it's a local IP (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
                const parts = ip.split('.');
                if (parts.length === 4) {
                  const firstOctet = parseInt(parts[0]);
                  const secondOctet = parseInt(parts[1]);
                  
                  if (firstOctet === 192 && secondOctet === 168) {
                    localIPs.push(ip);
                  } else if (firstOctet === 10) {
                    localIPs.push(ip);
                  } else if (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31) {
                    localIPs.push(ip);
                  }
                } else {
                  // IPv6 - check for local addresses
                  if (ip.startsWith('fe80:') || ip.startsWith('fc00:') || ip.startsWith('fd00:')) {
                    localIPs.push(ip);
                  }
                }
              }
            });
          }
        }
      };
      
      // Create offer to start ICE gathering
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .catch(err => {
          console.error('WebRTC error:', err);
          resolve({ localIPs: [], webrtcSupported: true, error: err.message });
        });
      
      // Timeout after 3 seconds
      setTimeout(() => {
        pc.close();
        resolve({ 
          localIPs: [...new Set(localIPs)], // Remove duplicates
          webrtcSupported: true 
        });
      }, 3000);
      
    } catch (error) {
      console.error('WebRTC IP leak detection error:', error);
      resolve({ localIPs: [], webrtcSupported: true, error: error.message });
    }
  });
};

// Utility function to collect detailed device and browser information

export const collectDeviceInfo = async () => {
  const info = {
    // Screen Resolution
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    
    // Browser Info
    browser: getBrowser(),
    browserVersion: getBrowserVersion(),
    
    // OS Info
    os: getOS(),
    osVersion: getOSVersion(),
    
    // Device Info
    deviceType: getDeviceType(),
    deviceModel: getDeviceModel(),
    isMobile: /Mobile|Android|iPhone|iPad/.test(navigator.userAgent),
    isTablet: /iPad|Android/.test(navigator.userAgent) && !/Mobile/.test(navigator.userAgent),
    
    // Language
    language: navigator.language || navigator.userLanguage || 'Unknown',
    languages: navigator.languages || [navigator.language],
    
    // Battery Level (if available)
    batteryLevel: null,
    batteryCharging: null,
    
    // Connection Type (if available)
    connectionType: getConnectionType(),
    connectionEffectiveType: null,
    connectionDownlink: null,
    isEthernet: false,
    downlinkSpeed: null,
    
    // Timezone
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: new Date().getTimezoneOffset(),
    
    // Platform
    platform: navigator.platform,
    vendor: navigator.vendor,
    
    // Viewport
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    
    // Color Depth
    colorDepth: window.screen.colorDepth,
    pixelDepth: window.screen.pixelDepth,
    
    // Hardware Concurrency
    hardwareConcurrency: navigator.hardwareConcurrency || 'Unknown',
    
    // Memory (if available)
    deviceMemory: navigator.deviceMemory || 'Unknown',
    
    // GPU Info (will be populated below)
    gpu: null,
    gpuVendor: null,
    gpuRenderer: null,
    
    // RAM Info
    ram: null,
    
    // Sensors
    hasAccelerometer: false,
    hasGyroscope: false,
    hasMagnetometer: false,
    hasOrientationSensor: false,
    
    // Sensor Data (will be populated below)
    accelerometerData: null,
    gyroscopeData: null,
    deviceOrientation: null,
    movementPattern: null, // Track movement over time
    
    // Camera & Microphone
    hasCamera: false,
    hasMicrophone: false,
    cameraCount: 0,
    microphoneCount: 0,
    
    // Audio Fingerprint (Oscillator Nodes)
    audioFingerprint: null,
    audioContextSupported: false,
    
    // Service Workers
    serviceWorkerRegistered: false,
    serviceWorkerActive: false,
    serviceWorkerScope: null,
    
    // WebRTC IP Leak (will be populated below)
    webrtcLocalIPs: [],
    webrtcSupported: false,
  };

  // Get battery level if available
  if (navigator.getBattery) {
    try {
      const battery = await navigator.getBattery();
      info.batteryLevel = Math.round(battery.level * 100);
      info.batteryCharging = battery.charging;
    } catch (e) {
      // Battery API not available
    }
  }

  // Get connection info if available
  if (navigator.connection || navigator.mozConnection || navigator.webkitConnection) {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) {
      info.connectionEffectiveType = connection.effectiveType || 'Unknown';
      info.connectionDownlink = connection.downlink || null;
      
      // Format downlink speed
      if (connection.downlink) {
        info.downlinkSpeed = `${connection.downlink} Mbps`;
      }
      
      // Check if using Ethernet
      if (connection.type === 'ethernet' || connection.effectiveType === 'ethernet') {
        info.isEthernet = true;
      } else if (info.connectionType && info.connectionType.toLowerCase().includes('ethernet')) {
        info.isEthernet = true;
      }
    }
  }
  
  // Additional Ethernet detection
  if (!info.isEthernet && navigator.hardwareConcurrency) {
    // Desktop with high core count is more likely to be Ethernet
    // This is a heuristic, not definitive
    if (navigator.hardwareConcurrency >= 4 && !info.isMobile && !info.isTablet) {
      // Could be Ethernet, but we can't be sure without connection API
    }
  }

  // Get GPU information using WebGL
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        info.gpuVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || 'Unknown';
        info.gpuRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'Unknown';
        info.gpu = `${info.gpuVendor} ${info.gpuRenderer}`;
      } else {
        // Fallback: try to get renderer info
        const renderer = gl.getParameter(gl.RENDERER);
        if (renderer) {
          info.gpu = renderer;
          info.gpuRenderer = renderer;
        }
      }
    }
  } catch (e) {
    console.error('Error getting GPU info:', e);
  }

  // Format RAM/Memory information
  if (navigator.deviceMemory) {
    info.ram = `${navigator.deviceMemory} GB`;
  } else {
    // Try to estimate from hardware concurrency (rough estimate)
    if (navigator.hardwareConcurrency) {
      const cores = navigator.hardwareConcurrency;
      // Very rough estimate: assume 2-4GB per core
      const estimatedRAM = cores * 2;
      info.ram = `~${estimatedRAM} GB (estimated)`;
    } else {
      info.ram = 'Unknown';
    }
  }

  // Check for sensors
  // Accelerometer
  if (window.DeviceMotionEvent || 'Accelerometer' in window) {
    info.hasAccelerometer = true;
  }

  // Gyroscope
  if (window.DeviceOrientationEvent || 'Gyroscope' in window) {
    info.hasGyroscope = true;
  }

  // Magnetometer
  if ('Magnetometer' in window) {
    info.hasMagnetometer = true;
  }

  // Orientation Sensor
  if ('OrientationSensor' in window || 'AbsoluteOrientationSensor' in window) {
    info.hasOrientationSensor = true;
  }

  // Media Device Enumeration: Cameras, Microphones, Speakers/Headsets
  try {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      // Request permissions first to get full device labels (optional, but helps)
      try {
        await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (permError) {
        // Permission denied is okay, we can still enumerate devices
      }
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      const microphones = devices.filter(device => device.kind === 'audioinput');
      const speakers = devices.filter(device => device.kind === 'audiooutput');
      
      info.hasCamera = cameras.length > 0;
      info.hasMicrophone = microphones.length > 0;
      info.hasSpeakers = speakers.length > 0;
      info.cameraCount = cameras.length;
      info.microphoneCount = microphones.length;
      info.speakerCount = speakers.length;
      
      // Store device IDs and labels
      info.cameraDevices = cameras.map(device => ({
        deviceId: device.deviceId,
        label: device.label || 'Unknown Camera',
        groupId: device.groupId
      }));
      
      info.microphoneDevices = microphones.map(device => ({
        deviceId: device.deviceId,
        label: device.label || 'Unknown Microphone',
        groupId: device.groupId
      }));
      
      info.speakerDevices = speakers.map(device => ({
        deviceId: device.deviceId,
        label: device.label || 'Unknown Speaker/Headset',
        groupId: device.groupId
      }));
      
      // Total media devices
      info.totalMediaDevices = devices.length;
    }
  } catch (e) {
    console.error('Error detecting media devices:', e);
  }

  // Audio Fingerprint using Oscillator Nodes
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      info.audioContextSupported = true;
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const analyser = audioContext.createAnalyser();
      const gainNode = audioContext.createGain();
      
      // Configure for fingerprinting
      oscillator.type = 'triangle';
      oscillator.frequency.value = 10000; // High frequency
      gainNode.gain.value = 0; // Silent
      
      oscillator.connect(analyser);
      analyser.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      analyser.fftSize = 2048;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      oscillator.start();
      
      // Get audio processing characteristics
      setTimeout(() => {
        analyser.getByteFrequencyData(dataArray);
        
        // Calculate fingerprint from audio processing
        let sum = 0;
        let max = 0;
        let min = 255;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
          if (dataArray[i] > max) max = dataArray[i];
          if (dataArray[i] < min) min = dataArray[i];
        }
        
        const avg = sum / bufferLength;
        const variance = dataArray.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / bufferLength;
        
        info.audioFingerprint = {
          average: Math.round(avg * 100) / 100,
          max: max,
          min: min,
          variance: Math.round(variance * 100) / 100,
          sampleRate: audioContext.sampleRate,
          fingerprint: `${audioContext.sampleRate}-${Math.round(avg)}-${max}-${min}`
        };
        
        oscillator.stop();
        audioContext.close();
      }, 100);
    }
  } catch (e) {
    console.error('Error generating audio fingerprint:', e);
    info.audioContextSupported = false;
  }

  // Detect Service Workers
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length > 0) {
        info.serviceWorkerRegistered = true;
        const activeWorker = registrations.find(reg => reg.active);
        if (activeWorker) {
          info.serviceWorkerActive = true;
          info.serviceWorkerScope = activeWorker.scope || 'Unknown';
        }
      }
    }
  } catch (e) {
    console.error('Error detecting service workers:', e);
  }

  // Try to request sensor permissions and detect availability
  try {
    if ('permissions' in navigator) {
      // Check accelerometer
      navigator.permissions.query({ name: 'accelerometer' }).then(() => {
        info.hasAccelerometer = true;
      }).catch(() => {});
      
      // Check gyroscope
      navigator.permissions.query({ name: 'gyroscope' }).then(() => {
        info.hasGyroscope = true;
      }).catch(() => {});
      
      // Check magnetometer
      navigator.permissions.query({ name: 'magnetometer' }).then(() => {
        info.hasMagnetometer = true;
      }).catch(() => {});
    }
  } catch (e) {
    // Permissions API not available or not supported
  }

  // Collect Accelerometer and Gyroscope data and WebRTC IPs
  return new Promise(async (resolve) => {
    // Wait for audio fingerprint to complete (with timeout)
    const audioTimeout = setTimeout(() => {
      // Audio fingerprint timeout - continue anyway
    }, 150);
    
    let sensorDataCollected = false;
    const sensorTimeout = setTimeout(async () => {
      if (!sensorDataCollected) {
        // Get WebRTC local IP addresses (IP leak detection)
        try {
          const webrtcInfo = await getWebRTCLocalIPs();
          info.webrtcLocalIPs = webrtcInfo.localIPs || [];
          info.webrtcSupported = webrtcInfo.webrtcSupported !== false;
        } catch (e) {
          console.error('Error getting WebRTC IPs:', e);
          info.webrtcLocalIPs = [];
          info.webrtcSupported = false;
        }
        clearTimeout(audioTimeout);
        resolve(info);
      }
    }, 3000); // 3 second timeout for sensors

    // Device Motion (Accelerometer) - Track movement pattern
    const movementSamples = [];
    let motionSampleCount = 0;
    const maxSamples = 10; // Collect 10 samples to track movement
    
    if (window.DeviceMotionEvent) {
      const handleMotion = async (event) => {
        if (event.acceleration || event.accelerationIncludingGravity) {
          info.hasAccelerometer = true;
          
          const gx = event.accelerationIncludingGravity?.x || 0;
          const gy = event.accelerationIncludingGravity?.y || 0;
          const gz = event.accelerationIncludingGravity?.z || 0;
          
          // Calculate angle (pitch and roll)
          const pitch = Math.atan2(gx, Math.sqrt(gy * gy + gz * gz)) * (180 / Math.PI);
          const roll = Math.atan2(gy, gz) * (180 / Math.PI);
          
          const sample = {
            x: event.acceleration?.x || gx || 0,
            y: event.acceleration?.y || gy || 0,
            z: event.acceleration?.z || gz || 0,
            pitch: Math.round(pitch * 100) / 100,
            roll: Math.round(roll * 100) / 100,
            timestamp: Date.now()
          };
          
          movementSamples.push(sample);
          motionSampleCount++;
          
          // Store latest sample as current data
          info.accelerometerData = {
            x: sample.x,
            y: sample.y,
            z: sample.z,
            angle: {
              pitch: sample.pitch,
              roll: sample.roll
            },
            timestamp: sample.timestamp
          };
          
          // Calculate movement pattern if we have enough samples
          if (motionSampleCount >= maxSamples) {
            const pitchChanges = [];
            const rollChanges = [];
            for (let i = 1; i < movementSamples.length; i++) {
              pitchChanges.push(Math.abs(movementSamples[i].pitch - movementSamples[i-1].pitch));
              rollChanges.push(Math.abs(movementSamples[i].roll - movementSamples[i-1].roll));
            }
            
            info.movementPattern = {
              averagePitchChange: Math.round((pitchChanges.reduce((a, b) => a + b, 0) / pitchChanges.length) * 100) / 100,
              averageRollChange: Math.round((rollChanges.reduce((a, b) => a + b, 0) / rollChanges.length) * 100) / 100,
              maxPitchChange: Math.round(Math.max(...pitchChanges) * 100) / 100,
              maxRollChange: Math.round(Math.max(...rollChanges) * 100) / 100,
              movementDetected: Math.max(...pitchChanges) > 1 || Math.max(...rollChanges) > 1,
              samples: motionSampleCount
            };
            
            sensorDataCollected = true;
            clearTimeout(sensorTimeout);
            window.removeEventListener('devicemotion', handleMotion);
            
            // Get WebRTC local IP addresses
            try {
              const webrtcInfo = await getWebRTCLocalIPs();
              info.webrtcLocalIPs = webrtcInfo.localIPs || [];
              info.webrtcSupported = webrtcInfo.webrtcSupported !== false;
            } catch (e) {
              console.error('Error getting WebRTC IPs:', e);
              info.webrtcLocalIPs = [];
              info.webrtcSupported = false;
            }
            
            resolve(info);
          }
        }
      };
      
      window.addEventListener('devicemotion', handleMotion);
      
      // Stop after collecting enough samples or timeout
      setTimeout(async () => {
        if (!sensorDataCollected && motionSampleCount > 0) {
          window.removeEventListener('devicemotion', handleMotion);
          sensorDataCollected = true;
          
          // Get WebRTC local IP addresses
          try {
            const webrtcInfo = await getWebRTCLocalIPs();
            info.webrtcLocalIPs = webrtcInfo.localIPs || [];
            info.webrtcSupported = webrtcInfo.webrtcSupported !== false;
          } catch (e) {
            console.error('Error getting WebRTC IPs:', e);
            info.webrtcLocalIPs = [];
            info.webrtcSupported = false;
          }
          
          clearTimeout(audioTimeout);
          resolve(info);
        }
      }, 3000);
    }

    // Device Orientation (Gyroscope)
    if (window.DeviceOrientationEvent) {
      const handleOrientation = async (event) => {
        info.hasGyroscope = true;
        info.deviceOrientation = {
          alpha: event.alpha !== null ? Math.round(event.alpha * 100) / 100 : null, // Z-axis rotation
          beta: event.beta !== null ? Math.round(event.beta * 100) / 100 : null,   // X-axis rotation (front-back tilt)
          gamma: event.gamma !== null ? Math.round(event.gamma * 100) / 100 : null, // Y-axis rotation (left-right tilt)
          timestamp: Date.now()
        };
        
        if (!sensorDataCollected) {
          sensorDataCollected = true;
          clearTimeout(sensorTimeout);
          window.removeEventListener('deviceorientation', handleOrientation);
          
          // Get WebRTC local IP addresses
          try {
            const webrtcInfo = await getWebRTCLocalIPs();
            info.webrtcLocalIPs = webrtcInfo.localIPs || [];
            info.webrtcSupported = webrtcInfo.webrtcSupported !== false;
          } catch (e) {
            console.error('Error getting WebRTC IPs:', e);
            info.webrtcLocalIPs = [];
            info.webrtcSupported = false;
          }
          
          clearTimeout(audioTimeout);
          resolve(info);
        }
      };
      
      window.addEventListener('deviceorientation', handleOrientation, { once: true });
    }

    // If no sensors available, get WebRTC and resolve immediately
    if (!window.DeviceMotionEvent && !window.DeviceOrientationEvent) {
      clearTimeout(sensorTimeout);
      try {
        const webrtcInfo = await getWebRTCLocalIPs();
        info.webrtcLocalIPs = webrtcInfo.localIPs || [];
        info.webrtcSupported = webrtcInfo.webrtcSupported !== false;
      } catch (e) {
        console.error('Error getting WebRTC IPs:', e);
        info.webrtcLocalIPs = [];
        info.webrtcSupported = false;
      }
      clearTimeout(audioTimeout);
      resolve(info);
    }
  });
};

// Helper functions
function getBrowser() {
  const ua = navigator.userAgent;
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
  if (ua.includes('MSIE') || ua.includes('Trident')) return 'Internet Explorer';
  return 'Unknown';
}

function getBrowserVersion() {
  const ua = navigator.userAgent;
  const match = ua.match(/(?:Chrome|Firefox|Safari|Edg|Opera|Version)\/(\d+)/);
  return match ? match[1] : 'Unknown';
}

function getOS() {
  const ua = navigator.userAgent;
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Mac OS')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  if (ua.includes('Unix')) return 'Unix';
  return 'Unknown';
}

function getOSVersion() {
  const ua = navigator.userAgent;
  const os = getOS();
  
  if (os === 'Windows') {
    const match = ua.match(/Windows NT (\d+\.\d+)/);
    if (match) {
      const version = match[1];
      const versions = {
        '10.0': '10/11',
        '6.3': '8.1',
        '6.2': '8',
        '6.1': '7'
      };
      return versions[version] || version;
    }
  }
  
  if (os === 'macOS') {
    const match = ua.match(/Mac OS X (\d+[._]\d+)/);
    return match ? match[1].replace('_', '.') : 'Unknown';
  }
  
  if (os === 'Android') {
    const match = ua.match(/Android (\d+\.\d+)/);
    return match ? match[1] : 'Unknown';
  }
  
  if (os === 'iOS') {
    const match = ua.match(/OS (\d+[._]\d+)/);
    return match ? match[1].replace('_', '.') : 'Unknown';
  }
  
  return 'Unknown';
}

function getDeviceType() {
  if (/Mobile|Android|iPhone/.test(navigator.userAgent)) return 'Mobile';
  if (/iPad|Android/.test(navigator.userAgent) && !/Mobile/.test(navigator.userAgent)) return 'Tablet';
  return 'Desktop';
}

function getDeviceModel() {
  const ua = navigator.userAgent;
  
  // iPhone
  if (ua.includes('iPhone')) {
    const match = ua.match(/iPhone\s*(\w+)/);
    return match ? `iPhone ${match[1]}` : 'iPhone';
  }
  
  // iPad
  if (ua.includes('iPad')) {
    return 'iPad';
  }
  
  // Android devices
  if (ua.includes('Android')) {
    const match = ua.match(/Android.*?;\s*([^)]+)\)/);
    return match ? match[1].trim() : 'Android Device';
  }
  
  return 'Desktop/Laptop';
}

function getConnectionType() {
  if (navigator.connection || navigator.mozConnection || navigator.webkitConnection) {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) {
      const type = connection.type || connection.effectiveType;
      if (type) {
        const types = {
          'wifi': 'WiFi',
          'cellular': 'Mobile Data',
          'ethernet': 'Ethernet',
          'bluetooth': 'Bluetooth',
          'wimax': 'WiMAX',
          'other': 'Other',
          'none': 'No Connection',
          '4g': '4G',
          '3g': '3G',
          '2g': '2G',
          'slow-2g': 'Slow 2G'
        };
        return types[type.toLowerCase()] || type;
      }
    }
  }
  return 'Unknown';
}

