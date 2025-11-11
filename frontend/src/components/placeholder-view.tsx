import React from 'react';

interface PlaceholderViewProps {
  title: string;
}

const PlaceholderView: React.FC<PlaceholderViewProps> = ({ title }) => {
  return (
    <div className="flex-1 flex items-center justify-center bg-background">
      <h1 className="text-3xl font-semibold text-text-primary">{title}</h1>
    </div>
  );
};

export default PlaceholderView;
