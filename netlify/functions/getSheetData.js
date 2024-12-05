const handler = async () => {
    try {
      const SHEET_ID = process.env.SHEET_ID;
      const API_KEY = process.env.GOOGLE_API_KEY;
      
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Data!A:J?key=${API_KEY}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(data)
      };
  
    } catch (error) {
      console.error('Error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: 'Failed fetching data',
          message: error.message 
        })
      };
    }
  };
  
  exports.handler = handler;