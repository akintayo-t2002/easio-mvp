import React from 'react';

type TextFieldProps = {
  label: string;
  value: string;
};

type TextAreaFieldProps = TextFieldProps & {
  multiline?: boolean;
};

export function TextField({ label, value }: TextFieldProps): React.JSX.Element {
  return (
    <div>
      <label>{label}</label>
      <input value={value} readOnly />
    </div>
  );
}

export function TextAreaField({ label, value }: TextAreaFieldProps): React.JSX.Element {
  return (
    <div>
      <label>{label}</label>
      <textarea value={value} readOnly />
    </div>
  );
}










