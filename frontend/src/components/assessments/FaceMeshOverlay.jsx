import { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import * as THREE from 'three';
import { Box } from '@mui/material';

const FaceMeshOverlay = ({ landmarks, videoWidth, videoHeight, visible = true }) => {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const meshRef = useRef(null);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    // Cleanup previous instances if they exist
    if (rendererRef.current && containerRef.current.contains(rendererRef.current.domElement)) {
      containerRef.current.removeChild(rendererRef.current.domElement);
    }

    // Setup scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Get actual container dimensions
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    
    // Use container dimensions if video dimensions aren't valid
    const width = videoWidth > 0 ? videoWidth : containerWidth;
    const height = videoHeight > 0 ? videoHeight : containerHeight;
    
    // Maintain aspect ratio
    const aspectRatio = width / height;

    // Setup orthographic camera for 2D-like view that matches video exactly
    const frustumSize = 2;
    const camera = new THREE.OrthographicCamera(
      frustumSize * aspectRatio / -2,
      frustumSize * aspectRatio / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.1,
      1000
    );
    camera.position.z = 5;
    cameraRef.current = camera;

    // Setup renderer with proper size
    const renderer = new THREE.WebGLRenderer({ 
      alpha: true,  // transparent background
      antialias: true 
    });
    
    // Set renderer size to match container
    renderer.setSize(containerWidth, containerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 1, 2);
    scene.add(directionalLight);

    // Animation loop
    const animate = () => {
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
      
      const animationId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
      
      // Store animation ID for cleanup
      rendererRef.current.animationId = animationId;
    };
    
    animate();
    
    animate();

    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      
      rendererRef.current.setSize(width, height);
    };
    
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      
      if (rendererRef.current) {
        if (rendererRef.current.animationId) {
          cancelAnimationFrame(rendererRef.current.animationId);
        }
        
        if (containerRef.current && containerRef.current.contains(rendererRef.current.domElement)) {
          containerRef.current.removeChild(rendererRef.current.domElement);
        }
        
        rendererRef.current.dispose();
      }
      
      if (meshRef.current) {
        scene.remove(meshRef.current);
        if (meshRef.current.geometry) meshRef.current.geometry.dispose();
        if (meshRef.current.material) {
          if (Array.isArray(meshRef.current.material)) {
            meshRef.current.material.forEach(material => material.dispose());
          } else {
            meshRef.current.material.dispose();
          }
        }
      }
    };
  }, [videoWidth, videoHeight]);

  // Update or create face mesh when landmarks change
  useEffect(() => {
    if (!sceneRef.current || !landmarks) return;
    
    if (!landmarks.face || landmarks.face.length === 0) {
      console.warn('No valid face landmarks provided');
      return;
    }

    // Remove old mesh if it exists
    if (meshRef.current) {
      sceneRef.current.remove(meshRef.current);
      if (meshRef.current.geometry) meshRef.current.geometry.dispose();
      if (meshRef.current.material) {
        if (Array.isArray(meshRef.current.material)) {
          meshRef.current.material.forEach(material => material.dispose());
        } else {
          meshRef.current.material.dispose();
        }
      }
      meshRef.current = null;
    }

    try {
      // Create face geometry from landmarks
      createFaceMesh(landmarks);
    } catch (error) {
      console.error('Error creating face mesh:', error);
    }
  }, [landmarks]);

  // Update visibility
  useEffect(() => {
    if (containerRef.current && rendererRef.current) {
      rendererRef.current.domElement.style.display = visible ? 'block' : 'none';
    }
  }, [visible]);

  const createFaceMesh = (landmarks) => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Color configuration for different facial regions
    const regionColors = {
      leftEye: 0x00ff00,
      rightEye: 0x00ff00,
      leftEyebrow: 0x00ffff,
      rightEyebrow: 0x00ffff,
      mouth: 0xff0000,
      nose: 0xffaa00,
      jawline: 0x0000ff,
      default: 0x0088ff
    };

    // Create a group to hold all face parts
    const faceGroup = new THREE.Group();
    scene.add(faceGroup);
    meshRef.current = faceGroup;

    // Scale factor to fit the face in the view - adjust based on video dimensions
    // The goal is to match coordinate systems between video and WebGL
    const scaleFactorX = 1.0;
    const scaleFactorY = 1.0;
    const offsetX = 0;
    const offsetY = 0;

    // Draw lines between connected facial feature points by region
    const drawLinesForRegion = (points, regionName) => {
      if (!points || points.length < 2) return;
      
      const lineGeometry = new THREE.BufferGeometry();
      const vertices = [];
      
      // Connect points to form a line
      for (let i = 0; i < points.length; i++) {
        const point = points[i];
        const nextPoint = points[(i + 1) % points.length]; // Loop back to first point
        
        if (point && nextPoint && 
            typeof point.x === 'number' && typeof point.y === 'number' &&
            typeof nextPoint.x === 'number' && typeof nextPoint.y === 'number') {
          
          // First point - normalize to NDC (Normalized Device Coordinates)
          // Transform from pixel coordinates to [-1, 1] range
          const x1 = ((point.x / videoWidth) * 2 - 1) * scaleFactorX + offsetX;
          const y1 = (((point.y / videoHeight) * 2 - 1) * -1) * scaleFactorY + offsetY; // Flip Y
          const z1 = 0;
          
          // Second point
          const x2 = ((nextPoint.x / videoWidth) * 2 - 1) * scaleFactorX + offsetX;
          const y2 = (((nextPoint.y / videoHeight) * 2 - 1) * -1) * scaleFactorY + offsetY; // Flip Y
          const z2 = 0;
          
          vertices.push(x1, y1, z1, x2, y2, z2);
        }
      }
      
      if (vertices.length > 0) {
        lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        
        const lineMaterial = new THREE.LineBasicMaterial({
          color: regionColors[regionName] || regionColors.default,
          linewidth: 3
        });
        
        const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
        faceGroup.add(lines);
      }
    };

    // Group landmarks by region and draw lines
    const regionMap = {};
    
    // Check if we have a raw landmarks structure or the processed format with regions
    if (landmarks.face && Array.isArray(landmarks.face)) {
      landmarks.face.forEach(point => {
        if (point && point.region) {
          if (!regionMap[point.region]) {
            regionMap[point.region] = [];
          }
          regionMap[point.region].push(point);
        }
      });
    } else {
      // Handle the case where landmarks might be structured by facial feature
      Object.entries(landmarks).forEach(([region, points]) => {
        if (region !== 'midline' && Array.isArray(points)) {
          regionMap[region] = points.map(point => ({
            ...point,
            region: region
          }));
        }
      });
    }

    // Draw lines for each region
    Object.entries(regionMap).forEach(([region, points]) => {
      drawLinesForRegion(points, region);
    });

    // If we have a midline, draw it
    if (landmarks.midline) {
      const { top, bottom } = landmarks.midline;
      
      if (top && bottom && 
          typeof top.x === 'number' && typeof top.y === 'number' &&
          typeof bottom.x === 'number' && typeof bottom.y === 'number') {
        
        const midlineGeometry = new THREE.BufferGeometry();
        const vertices = [];
        
        // Normalize coordinates
        const x1 = ((top.x / videoWidth) * 2 - 1) * scaleFactorX + offsetX;
        const y1 = (((top.y / videoHeight) * 2 - 1) * -1) * scaleFactorY + offsetY;
        const z1 = 0;
        
        const x2 = ((bottom.x / videoWidth) * 2 - 1) * scaleFactorX + offsetX;
        const y2 = (((bottom.y / videoHeight) * 2 - 1) * -1) * scaleFactorY + offsetY;
        const z2 = 0;
        
        vertices.push(x1, y1, z1, x2, y2, z2);
        
        midlineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        
        const midlineMaterial = new THREE.LineBasicMaterial({
          color: 0xffff00,
          linewidth: 5
        });
        
        const midline = new THREE.LineSegments(midlineGeometry, midlineMaterial);
        faceGroup.add(midline);
      }
    }
  };

  return (
    <Box 
      ref={containerRef}
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        '& canvas': {
          position: 'absolute',
          width: '100% !important',
          height: '100% !important',
          transform: 'scaleX(-1)', // Mirror to match video
        }
      }}
    />
  );
};

FaceMeshOverlay.propTypes = {
  landmarks: PropTypes.object,
  videoWidth: PropTypes.number.isRequired,
  videoHeight: PropTypes.number.isRequired,
  visible: PropTypes.bool
};

export default FaceMeshOverlay;