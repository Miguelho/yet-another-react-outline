# React Outline

Enhanced React component outline with JSX tree visualization for Visual Studio Code.

## Features

This extension provides an enhanced outline view for React files (`.jsx` and `.tsx`), showing:

- **Function Components** (both declaration and arrow function syntax)
- **Class Components** (extending `React.Component` or `PureComponent`)
- **Custom Hooks** (functions starting with `use`)
- **JSX Tree Structure** - Visualize the HTML/JSX elements inside each component with hierarchical tree

### Component Detection

The extension automatically detects and displays:

```typescript
// Function Declaration Component
function Header() {
  return <header>...</header>
}

// Arrow Function Component
const Button = () => <button>...</button>

// Class Component
class TodoList extends React.Component {
  render() {
    return <div>...</div>
  }
}

// Custom Hooks
function useCustomHook() { ... }
const useAuth = () => { ... }
```

### JSX Tree Visualization

For each component, the outline shows its internal JSX structure:

```
├─ TodoList (Class Component)
   └─ div
      ├─ h1
      └─ ul
         ├─ li
         └─ li
```

The extension also handles:
- Conditional rendering: `{condition && <Element>}`
- Ternary expressions: `{condition ? <A> : <B>}`
- Array mapping: `{items.map(item => <Item />)}`
- React Fragments: `<>...</>` and `<React.Fragment>...</React.Fragment>`

## Extension Settings

This extension contributes the following settings:

* `reactOutline.maxJSXDepth`: Maximum depth for JSX tree in outline (default: `2`)
* `reactOutline.showFragments`: Show React Fragments in outline (default: `true`)
* `reactOutline.showHooks`: Show custom hooks in outline (default: `true`)

## Usage

1. Open any `.jsx` or `.tsx` file
2. Open the Outline panel (View → Outline or `Ctrl+Shift+O`)
3. Navigate through your React components and their JSX structure

## Requirements

No additional requirements or dependencies needed.

## Release Notes

### 0.0.1

Initial release:
- Function component detection (declaration and arrow function)
- Class component detection
- Custom hooks detection
- JSX tree visualization with configurable depth
- Support for conditional rendering and array mapping
- Configurable fragment display

---

**Enjoy enhanced React development!**
