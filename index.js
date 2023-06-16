const mysql = require('mysql');
const axios = require('axios').default; // Assuming you're using axios for API requests
const https = require('https');

const dotenv = require('dotenv'); // Load environment variables from .env file
dotenv.config();

// Create a MySQL connection
const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

// Connect to the MySQL database
connection.connect(async (err) => {
    if (err) {
        console.error('Error connecting to the client database:', err);
        return;
    }
    console.log('Connected to the client database');
    console.log("Importing Started");
    // Call functions to retrieve and migrate data here
    // For example:
    try {
        await retrieveData();
        await categoriesData();
        await listingsData();
        console.log('Importing Finished');
    } catch (error) {
        console.error('Error during data import:', error);
    } finally {
        connection.end(); // Close the database connection
    }
});

// Function to retrieve data from the client's MySQL database
async function retrieveData() {
    console.log("the start");
    const query = 'SELECT * FROM user WHERE imported_at IS NULL'; // Select rows with imported_at as NULL

    try {
        const results = await new Promise((resolve, reject) => {
            connection.query(query, (err, results) => {
                if (err) {
                    console.error('Error retrieving data from client database:', err);
                    reject(err);
                    return;
                }
                resolve(results);
            });
        });

        // Process the retrieved data and send it to your system's API
        for (const row of results) {
            console.log(row);
            const inputBody = {
                account_type: "individual",
                address_city: row.country_of_residence,
                address_country: row.country_of_residence,
                address_line1: null,
                address_line2: null,
                address_state: null,
                address_zipcode: null,
                attributes: {
                    profession: row.profession,
                },
                avatar : null,
                business_name: row.company_name,
                can_post_listing: true,
                email: row.email,
                first_name: row.first_name,
                group_id: 845751,
                locale: null,
                note: null,
                phone_country_number: row.phone_prefix,
                phone_number: row.phone,
                status: row.enabled ? "enabled" : "disabled",
                review_count: null,
                timezone: row.time_zone,
                username: row.username,
            };

            console.log(inputBody);

            await sendDataToAPI(inputBody, row.id); // Pass the row id to the sendDataToAPI function
        }
    } catch (error) {
        console.error('Error retrieving data from client database:', error);
    }
  
}
  
  // Function to send the transformed data to kreezalid system's API
async function sendDataToAPI(data, rowId) {
    try {
        console.log("++++++++++++++++++++++++++++++++++++");
        const authUsername  = process.env.AUTH_USERNAME;
        const authPassword  = process.env.AUTH_PASSWORD;
        const apiEndpoint   = process.env.API_ENDPOINT;

        const authHeader = `Basic ${Buffer.from(`${authUsername}:${authPassword}`, 'utf8').toString('base64')}`;
        const response = await axios.post(apiEndpoint+'/users', data, {
            headers: {
              Authorization: authHeader,
            },
            httpsAgent: new https.Agent({ rejectUnauthorized: false }), // Disable SSL certificate verification
        });
        console.log("-----------------------------------");
        console.log('Data sent to API successfully:', response.data);
        const kreezalidId = response.data.id;// Assuming the response contains the id
        if (kreezalidId) {
            await updateRowAsync(kreezalidId, rowId); // Update kreezalid_id and imported_at
        } 
        
    } catch (error) {
        console.log(error);
    }
}

function updateRowAsync(kreezalidId, rowId) {
    return new Promise((resolve, reject) => {
        console.log("//////////////////////");
        const updateQuery = 'UPDATE user SET kreezalid_id = ?, imported_at = NOW() WHERE id = ?';
        connection.query(updateQuery, [kreezalidId, rowId], (err, result) => {
            if (err) {
                console.error('Error updating row:', err);
                reject(err);
                return;
            }
            console.log('Row updated successfully:', result.affectedRows);
            resolve(result);
        });
    });
}


async function categoriesData(){
    const query = `
        SELECT lc.*, lct.name, lct.slug
        FROM listing_category lc
        JOIN (
        SELECT translatable_id, MIN(id) AS translation_id
        FROM listing_category_translation
        GROUP BY translatable_id
        ) lctt ON lc.id = lctt.translatable_id
        JOIN listing_category_translation lct ON lct.id = lctt.translation_id
        WHERE lc.imported_at IS NULL
    `;

    try {
        const results = await new Promise((resolve, reject) => {
            connection.query(query, (err, results) => {
                if (err) {
                    console.error('Error retrieving data from client database:', err);
                    reject(err);
                    return;
                }
                resolve(results);
            });
        });

        // Process the retrieved data and send it to your system's API
        for (const row of results) {
            console.log(row);
            const inputBody = {
                external_id: row.id,
                title: row.name,
                page_title: row.name, // Add the appropriate field for page title
                description: null, // Add the appropriate field for description
                slug: row.slug,
                lft: row.lft,
                rght: row.rgt,
                level: row.lvl
            };

            await sendDataToAPICategory(inputBody, row.id); // Pass the row id to the sendDataToAPI function
        }
    } catch (error) {
        console.error('Error retrieving data from client database:', error);
    }
}

async function sendDataToAPICategory(data, rowId){
    try {
        console.log("++++++++++++++++++++++++++++++++++++");
        const authUsername = process.env.AUTH_USERNAME;
        const authPassword = process.env.AUTH_PASSWORD;
        const apiEndpoint = process.env.API_ENDPOINT;

        const authHeader = `Basic ${Buffer.from(`${authUsername}:${authPassword}`, 'utf8').toString('base64')}`;
        const response = await axios.post(apiEndpoint+'/categories', data, {
            headers: {
              Authorization: authHeader,
            },
            httpsAgent: new https.Agent({ rejectUnauthorized: false }), // Disable SSL certificate verification
        });
        console.log("-----------------------------------");
        console.log('Data sent to API successfully:', response.data);
        const kreezalidId = response.data.id;// Assuming the response contains the id
        if (kreezalidId) {
            await updateRowAsyncCategory(kreezalidId, rowId); // Update kreezalid_id and imported_at
        } 
        
    } catch (error) {
        console.log(error);
    }
}

function updateRowAsyncCategory(kreezalidId, rowId){
    return new Promise((resolve, reject) => {
        console.log("//////////////////////");
        const updateQuery = 'UPDATE listing_category SET kreezalid_id = ?, imported_at = NOW() WHERE id = ?';
        connection.query(updateQuery, [kreezalidId, rowId], (err, result) => {
            if (err) {
                console.error('Error updating row:', err);
                reject(err);
                return;
            }
            console.log('Row updated successfully:', result.affectedRows);
            resolve(result);
        });
    });
}

async function listingsData(){
    const query = `
        SELECT l.*, lc.listing_category_id, c.kreezalid_id AS category_kreezalid_id , u.kreezalid_id AS user_kreezalid_id
        FROM listing AS l
        JOIN listing_listing_category AS lc ON l.id = lc.listing_id
        JOIN listing_category AS c ON lc.listing_category_id = c.id
        JOIN user AS u ON l.user_id = u.id
        WHERE l.imported_at IS NULL
    `;
    try {
        const results = await new Promise((resolve, reject) => {
            connection.query(query, (err, results) => {
                if (err) {
                    console.error('Error retrieving data from client database:', err);
                    reject(err);
                    return;
                }
                resolve(results);
            });
        });

        // Process the retrieved data and send it to your system's API
        for (const row of results) {
            console.log(row);
            const inputBody = {
                attributes: "[]",
                category_id: row.category_kreezalid_id,
                city: row.city,
                country: row.country,
                currency: "USD", // Fill in the currency value
                description: row.description,
                external_id: row.id,
                price: row.price,
                shipping_methods: [{}], // Fill in the shipping_methods value
                user_id: row.user_kreezalid_id, // Fill in the user_id value
                title: "coaching" ,
                order_type_id : 3
              };

            await sendDataToAPIListing(inputBody, row.id); // Pass the row id to the sendDataToAPI function
        }
    } catch (error) {
        console.error('Error retrieving data from client database:', error);
    }
}

async function sendDataToAPIListing(data, rowId){
    try {
        console.log("++++++++++++++++++++++++++++++++++++");
        const authUsername  = process.env.AUTH_USERNAME;
        const authPassword  = process.env.AUTH_PASSWORD;
        const apiEndpoint   = process.env.API_ENDPOINT;

        const authHeader = `Basic ${Buffer.from(`${authUsername}:${authPassword}`, 'utf8').toString('base64')}`;
        const response = await axios.post(apiEndpoint+'listings', data, {
            headers: {
              Authorization: authHeader,
            },
            httpsAgent: new https.Agent({ rejectUnauthorized: false }), // Disable SSL certificate verification
        });
        console.log("-----------------------------------");
        console.log('Data sent to API successfully:', response.data);
        const kreezalidId = response.data.id;// Assuming the response contains the id
        if (kreezalidId) {
            await updateRowAsyncListing(kreezalidId, rowId); // Update kreezalid_id and imported_at
        } 
        
    } catch (error) {
        console.log(error);
    }
}

function updateRowAsyncListing(kreezalidId,rowId){
    return new Promise((resolve, reject) => {
        console.log("//////////////////////");
        const updateQuery = 'UPDATE listing SET kreezalid_id = ?, imported_at = NOW() WHERE id = ?';
        connection.query(updateQuery, [kreezalidId, rowId], (err, result) => {
            if (err) {
                console.error('Error updating row:', err);
                reject(err);
                return;
            }
            console.log('Row updated successfully:', result.affectedRows);
            resolve(result);
        });
    });
}
  
