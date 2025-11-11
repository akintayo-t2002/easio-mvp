import React from 'react';

type TextFieldProps = {
  label: string;
  value: string;
};

type TextAreaFieldProps = TextFieldProps & {
  multiline?: boolean;
};

export const TextField: React.FC<TextFieldProps> = ({ label, value }) => {
  return (
    <div>
      <label>{label}</label>
      <input value={value} readOnly />
    </div>
  );
};

export const TextAreaField: React.FC<TextAreaFieldProps> = ({ label, value }) => {
  return (
    <div>
      <label>{label}</label>
      <textarea value={value} readOnly />
    </div>
  );
};
