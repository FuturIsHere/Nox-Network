import React from 'react';

interface UnreadBadgeProps {
  count: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const UnreadBadge: React.FC<UnreadBadgeProps> = ({ 
  count, 
  className = '', 
  size = 'md' 
}) => {
  // Ne pas afficher le badge si le compteur est 0
  if (count === 0) return null;

  const sizeClasses = {
    sm: 'w-4 h-4 text-xs',
    md: 'w-5 h-5 text-xs',
    lg: 'w-6 h-6 text-sm'
  };

  const displayCount = count > 99 ? '99+' : count.toString();

  return (
    <span 
      className={`
        ${sizeClasses[size]} 
        bg-blue-500 text-white rounded-full 
        flex items-center justify-center 
        font-medium leading-none
        p-3
        ${className}
      `}
    >
      {displayCount}
    </span>
  );
};

export { UnreadBadge };