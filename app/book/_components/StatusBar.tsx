import { useState, useEffect } from 'react';

export interface StatusBarProps {
  loading: boolean;
  text: string;
}

export default function StatusBar(props: StatusBarProps) {
  const [shouldRender, setShouldRender] = useState(props.loading);
  
  useEffect(() => {
    // When loading becomes true, immediately show text
    if (props.loading) {
      //@ts-nocheck
      setShouldRender(true);
    } 
    // When loading becomes false, delay hiding the text
    else {
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 2000);
      
      // Clean up timer if component unmounts or loading changes again
      return () => clearTimeout(timer);
    }
  }, [props.loading]);

  return shouldRender && (
    <div className="w-full h-8 px-2">      
      <div className="w-full text-sm font-medium">
        {props.text}
      </div>

      {/* Loading background animation */}
      {props.loading && (
        <div className="h-1 w-full animate-[statusBarLoading_2s_linear_infinite] bg-gradient-to-r from-transparent via-blue-200/30 to-transparent" />
      )}
    </div>
  );
}
