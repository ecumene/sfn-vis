import { useState, useEffect, useCallback, useRef } from "react";

export default function useFetch<T>(url: string, options: RequestInit = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const isMounted = useRef<boolean>(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    if (!data && !error) {
      try {
        const response = await fetch(url, options);
        const json = await response.json();
        if (isMounted.current) {
          setData(json);
        }
      } catch (error) {
        if (isMounted.current) {
          setError(error as Error);
        }
      }
      // todo
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return { data, error, loading, fetchData };
}
