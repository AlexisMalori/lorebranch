import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { store, bootstrapFromDB } from "./store";
import App from "./App";

// Hydrate the Redux store from SQLite before rendering.
// The app renders a loading state until dbReady === true.
bootstrapFromDB(store.dispatch).then(() => {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <Provider store={store}>
      <App />
    </Provider>
  );
});