import React, { useState } from 'react';

// Arrow function component
const Button = ({ label }: { label: string }) => (
  <button className="btn">
    <span>{label}</span>
  </button>
);

// Arrow function component with block
const Card = ({ title, content }: { title: string; content: string }) => {
  return (
    <div className="card">
      <h2>{title}</h2>
      <p>{content}</p>
    </div>
  );
};

// Function declaration component
function Header() {
  return (
    <header>
      <h1>My App</h1>
      <nav>
        <a href="/">Home</a>
        <a href="/about">About</a>
      </nav>
    </header>
  );
}

// Class component
class TodoList extends React.Component {
  render() {
    return (
      <div className="todo-list">
        <h1>Todos</h1>
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
        </ul>
      </div>
    );
  }
}

// Component with conditional rendering
const ConditionalComponent = ({ showTitle }: { showTitle: boolean }) => (
  <div>
    {showTitle && <h1>Title</h1>}
    <p>Content always visible</p>
  </div>
);

// Component with ternary
const TernaryComponent = ({ isLoggedIn }: { isLoggedIn: boolean }) => (
  <div>
    {isLoggedIn ? <span>Welcome!</span> : <span>Please login</span>}
  </div>
);

// Component with map
const List = ({ items }: { items: string[] }) => (
  <ul>
    {items.map(item => (
      <li key={item}>{item}</li>
    ))}
  </ul>
);

// Component with React.Fragment
const FragmentExample = () => (
  <React.Fragment>
    <div>First</div>
    <div>Second</div>
  </React.Fragment>
);

// Component with short fragment syntax
const ShortFragmentExample = () => (
  <>
    <div>First</div>
    <div>Second</div>
  </>
);

// Nested components (not recommended but should work)
function Parent() {
  function Child() {
    return (
      <div className="child">
        <span>Child content</span>
      </div>
    );
  }

  return (
    <div className="parent">
      <Child />
    </div>
  );
}

// Custom hook (function)
function useCustomHook() {
  const [value, setValue] = useState(0);
  return { value, setValue };
}

// Custom hook (arrow)
const useAuth = () => {
  const [user, setUser] = useState(null);
  return { user, login: () => {}, logout: () => {} };
};

// Component with deep JSX nesting (should respect maxDepth)
const DeepNesting = () => (
  <div>
    <section>
      <article>
        <div>
          <p>Level 4</p>
        </div>
      </article>
    </section>
  </div>
);

export { Button, Card, Header, TodoList, Parent, useCustomHook, useAuth };
