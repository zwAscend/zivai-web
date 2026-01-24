/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ['class'],
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            colors: {
                // Your existing color palette is great and remains unchanged.
                blue: {
                    '50': '#f0f9ff',
                    '100': '#e0f2fe',
                    '200': '#bae6fd',
                    '300': '#7dd3fc',
                    '400': '#38bdf8',
                    '500': '#0ea5e9',
                    '600': '#0284c7',
                    '700': '#0369a1',
                    '800': '#075985',
                    '900': '#0c4a6e'
                },
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                card: {
                    DEFAULT: 'hsl(var(--card))',
                    foreground: 'hsl(var(--card-foreground))'
                },
                popover: {
                    DEFAULT: 'hsl(var(--popover))',
                    foreground: 'hsl(var(--popover-foreground))'
                },
                primary: {
                    DEFAULT: 'hsl(var(--primary))',
                    foreground: 'hsl(var(--primary-foreground))'
                },
                secondary: {
                    DEFAULT: 'hsl(var(--secondary))',
                    foreground: 'hsl(var(--secondary-foreground))'
                },
                muted: {
                    DEFAULT: 'hsl(var(--muted))',
                    foreground: 'hsl(var(--muted-foreground))'
                },
                accent: {
                    DEFAULT: 'hsl(var(--accent))',
                    foreground: 'hsl(var(--accent-foreground))'
                },
                destructive: {
                    DEFAULT: 'hsl(var(--destructive))',
                    foreground: 'hsl(var(--destructive-foreground))'
                },
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
                chart: {
                    '1': 'hsl(var(--chart-1))',
                    '2': 'hsl(var(--chart-2))',
                    '3': 'hsl(var(--chart-3))',
                    '4': 'hsl(var(--chart-4))',
                    '5': 'hsl(var(--chart-5))'
                }
            },
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)'
            },
            // ✨ OPTIMIZED ANIMATION SECTION
            keyframes: {
                fadeIn: {
                    '0%': {
                        opacity: 0,
                        transform: 'translateY(10px)'
                    },
                    '100%': {
                        opacity: 1,
                        transform: 'translateY(0)'
                    }
                },
                // Explicitly adding pulse for skeleton loader clarity
                pulse: {
                  '50%': {
                    opacity: '.5'
                  }
                }
            },
            animation: {
                // Adjusted duration for a slightly smoother effect
                fadeIn: 'fadeIn 0.5s ease-in-out',
                // Added pulse animation for skeleton loader
                pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
            },
        }
    },
    plugins: [require("tailwindcss-animate")],
};