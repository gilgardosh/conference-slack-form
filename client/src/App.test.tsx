import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('should render the form', () => {
    const { container } = render(<App />);

    expect(screen.getByText("Let's Continue on Slack")).toBeDefined();
    expect(screen.getByText(/Join our Slack workspace/)).toBeDefined();
    expect(screen.getByLabelText('Company Name')).toBeDefined();
    expect(screen.getByLabelText('Email Address')).toBeDefined();
    expect(container.querySelector('button[type="submit"]')).toBeDefined();
  });

  it('should have submit button disabled initially', () => {
    const { container } = render(<App />);

    const submitButton = container.querySelector(
      'button[type="submit"]'
    ) as HTMLButtonElement;
    expect(submitButton?.disabled).toBe(true);
  });
});
