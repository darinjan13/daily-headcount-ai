import { useId } from "react";
import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const inputId = useId();

  return (
    <label
      className="theme-switch"
      htmlFor={inputId}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <input
        id={inputId}
        className="theme-switch-input"
        type="checkbox"
        checked={isDark}
        onChange={toggleTheme}
      />
      <span className="theme-switch-slider theme-switch-round">
        <span className="theme-switch-sun-moon">
          <svg id="theme-moon-dot-1" className="theme-moon-dot" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="50" />
          </svg>
          <svg id="theme-moon-dot-2" className="theme-moon-dot" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="50" />
          </svg>
          <svg id="theme-moon-dot-3" className="theme-moon-dot" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="50" />
          </svg>
          <svg id="theme-light-ray-1" className="theme-light-ray" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="50" />
          </svg>
          <svg id="theme-light-ray-2" className="theme-light-ray" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="50" />
          </svg>
          <svg id="theme-light-ray-3" className="theme-light-ray" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="50" />
          </svg>
          <svg id="theme-cloud-1" className="theme-cloud-dark" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="50" />
          </svg>
          <svg id="theme-cloud-2" className="theme-cloud-dark" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="50" />
          </svg>
          <svg id="theme-cloud-3" className="theme-cloud-dark" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="50" />
          </svg>
          <svg id="theme-cloud-4" className="theme-cloud-light" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="50" />
          </svg>
          <svg id="theme-cloud-5" className="theme-cloud-light" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="50" />
          </svg>
          <svg id="theme-cloud-6" className="theme-cloud-light" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="50" />
          </svg>
        </span>
        <span className="theme-stars">
          <svg id="theme-star-1" className="theme-star" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M 0 10 C 10 10,10 10 ,0 10 C 10 10 , 10 10 , 10 20 C 10 10 , 10 10 , 20 10 C 10 10 , 10 10 , 10 0 C 10 10,10 10 ,0 10 Z" />
          </svg>
          <svg id="theme-star-2" className="theme-star" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M 0 10 C 10 10,10 10 ,0 10 C 10 10 , 10 10 , 10 20 C 10 10 , 10 10 , 20 10 C 10 10 , 10 10 , 10 0 C 10 10,10 10 ,0 10 Z" />
          </svg>
          <svg id="theme-star-3" className="theme-star" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M 0 10 C 10 10,10 10 ,0 10 C 10 10 , 10 10 , 10 20 C 10 10 , 10 10 , 20 10 C 10 10 , 10 10 , 10 0 C 10 10,10 10 ,0 10 Z" />
          </svg>
          <svg id="theme-star-4" className="theme-star" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M 0 10 C 10 10,10 10 ,0 10 C 10 10 , 10 10 , 10 20 C 10 10 , 10 10 , 20 10 C 10 10 , 10 10 , 10 0 C 10 10,10 10 ,0 10 Z" />
          </svg>
        </span>
      </span>
    </label>
  );
}