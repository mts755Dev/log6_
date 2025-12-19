import { motion } from 'framer-motion';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'auto';
}

export function Logo({ size = 'md' }: LogoProps) {
  // 'auto' means no size constraint - use original image size
  if (size === 'auto') {
    return (
      <motion.div 
        className="flex items-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <img 
          src="/assets/Logi6 Logo.png" 
          alt="Logi6 Logo"
          className="object-contain"
        />
      </motion.div>
    );
  }

  const sizes = {
    sm: 60,   // For mobile header
    md: 80,   // For sidebar
    lg: 140,  // Larger display
    xl: 200,  // Hero/landing page
  };

  const icon = sizes[size];

  return (
    <motion.div 
      className="flex items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <img 
        src="/assets/Logi6 Logo.png" 
        alt="Logi6 Logo"
        style={{ width: icon, height: 'auto' }}
        className="object-contain"
      />
    </motion.div>
  );
}
