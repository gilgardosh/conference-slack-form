import { useState } from 'react';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
      <div className="max-w-md mx-auto p-6 bg-gray-50 dark:bg-gray-800 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Conference Slack Form
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          React SPA placeholder - form components will be implemented here.
        </p>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setCount(count + 1)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Count: {count}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
