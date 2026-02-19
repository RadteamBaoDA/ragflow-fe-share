import { Routes } from '@/routes';
import { history } from '@/utils/simple-history-util';
import { useLocation } from 'react-router';

const NoFoundPage = () => {
  const location = useLocation();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
      <p className="text-lg text-muted-foreground">
        Page not found, please enter a correct address.
      </p>
      <button
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        onClick={() => {
          history.push(
            location.pathname.startsWith(Routes.Admin) ? Routes.Admin : '/',
          );
        }}
      >
        Business
      </button>
    </div>
  );
};

export default NoFoundPage;
