/* This toggles the upload method between file and URL */
function toggleUploadMethod(): void {
    const uploadMethod: string = (document.querySelector('input[name="uploadMethod"]:checked') as HTMLInputElement).value;
    const fileInputSection: HTMLElement = document.getElementById('fileInputSection') as HTMLElement;
    const urlInputSection: HTMLElement = document.getElementById('urlInputSection') as HTMLElement;
    const moduleNameTitle: HTMLElement = document.getElementById('modulenametitle') as HTMLElement;

    if (uploadMethod === 'file') {
        fileInputSection.classList.remove('hidden');
        urlInputSection.classList.add('hidden');
        moduleNameTitle.textContent = 'Module Name (Required)';
        clearURLInput();
    } else {
        fileInputSection.classList.add('hidden');
        urlInputSection.classList.remove('hidden');
        moduleNameTitle.textContent = 'Module Name (Optional)';
        removeFile();
    }
}

/* This function uploads a module to the server using POST /package */
async function uploadModule(): Promise<void> {
    const uploadMethod: string = (document.querySelector('input[name="uploadMethod"]:checked') as HTMLInputElement).value;
    const formData: FormData = new FormData();
    const uploadResultElement: HTMLElement | null = document.getElementById('uploadResult');
    if (uploadResultElement) {
        uploadResultElement.innerHTML = '';
    }

    try {
        const loadingSpinner: HTMLElement | null = document.getElementById('loadingSpinner');
        if (loadingSpinner) {
            loadingSpinner.style.display = 'block';
        }

        const moduleNameElement: HTMLInputElement | null = document.getElementById('moduleName') as HTMLInputElement;
        const debloatElement: HTMLInputElement | null = document.getElementById('debloat') as HTMLInputElement;

        let requestBody: any;

        if (uploadMethod === 'file') {
            const fileInput: HTMLInputElement | null = document.getElementById('moduleFile') as HTMLInputElement;
            if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
                throw new Error('No file selected');
            }

            // Convert file to base64
            const file = fileInput.files[0];
            const base64String = await readFileAsBase64(file);
            formData.append('moduleFile', base64String);

            requestBody = {
                Content: base64String,
                debloat: debloatElement.checked,
                Name: moduleNameElement.value,
            };
        } else if (uploadMethod === 'url') {
            const urlInputElement: HTMLInputElement | null = document.getElementById('npmPackageURL') as HTMLInputElement;
            if (!urlInputElement || !urlInputElement.value) {
                throw new Error('No URL provided');
            }

            requestBody = {
                URL: urlInputElement.value,
                debloat: debloatElement.checked,
                Name: moduleNameElement.value || '',
            };
        }

        const response: Response = await fetch('https://dofogoenof.execute-api.us-east-2.amazonaws.com/MainStage/package', {
            method: 'POST',
            body: JSON.stringify(requestBody),
        });

        const result = await response.json();
        if (response.status !== 201) {
            throw new Error(result);
        }

        // Successfully uploaded, show success message
        if (uploadResultElement) {
            uploadResultElement.style.color = 'green';
            uploadResultElement.innerHTML = `Successfully uploaded module. ID: ${result.metadata.ID as string}`;
        }
        setTimeout(() => {
            uploadResultElement!.innerHTML = '';
        }, 5000); // 5000ms = 5 seconds
    } catch (error: any) {
        // Show error message
        if (uploadResultElement) {
            uploadResultElement.style.color = 'red';
            uploadResultElement.innerHTML = error!.message || 'Upload failed. Please try again.';
        }

        setTimeout(() => {
            uploadResultElement!.innerHTML = '';
        }, 5000); // 5000ms = 5 seconds
        console.error('Upload error:', error);
    } finally {
        // Hide loading spinner once the process is complete
        const loadingSpinner: HTMLElement | null = document.getElementById('loadingSpinner');
        if (loadingSpinner) {
            loadingSpinner.style.display = 'none';
        }
    }
}

/* This function downloads a module from the server using GET /package/{id} */
async function downloadPackage() {
    try {
        const loadingSpinner: HTMLElement | null = document.getElementById('loadingSpinner2');
        if (loadingSpinner) {
            loadingSpinner.style.display = 'block';
        }
        let name = (document.getElementById('downloadModuleName') as HTMLInputElement).value;
        let version = (document.getElementById('downloadModuleVersion') as HTMLInputElement).value;
        // Convert name and version to strings
        name = name.toString();
        version = version.toString();

        const reqbody = [{
            Name: name,
            Version: version
        }];

        // Get package ID using POST /packages
        const searchResponse: Response = await fetch(`https://dofogoenof.execute-api.us-east-2.amazonaws.com/MainStage/packages`, {
            method: 'POST',
            body: JSON.stringify(reqbody)
        });

        if (!searchResponse.ok) throw new Error('Package not found');

        const packages = await searchResponse.json();
        console.log(packages);  // Debugging
        if (!packages.length) throw new Error('Package not found');

        // Get package content using GET /package/{id}
        const packageId = packages[0].ID;
        const contentResponse = await fetch(`https://dofogoenof.execute-api.us-east-2.amazonaws.com/MainStage/package/${packageId}`);
        if (!contentResponse.ok) throw new Error('Failed to download package');
        const resp = await contentResponse.json();
        const content = resp.data.Content;
        console.log(content);  // Debugging

        // Decode the base64 string into a byte array
        const byteCharacters = atob(content);  // atob decodes base64 into a binary string
        const byteArray = new Uint8Array(byteCharacters.length);

        // Convert the binary string into an array of bytes
        for (let i = 0; i < byteCharacters.length; i++) {
            byteArray[i] = byteCharacters.charCodeAt(i);
        }

        // Create a Blob from the byte array
        const contentBlob = new Blob([byteArray], { type: 'application/zip' });

        // Create download link
        const downloadUrl = window.URL.createObjectURL(contentBlob);
        const downloadLink = document.createElement('a');
        downloadLink.href = downloadUrl;
        if (resp.data.URL && resp.data.URL.includes("npmjs.com")) {
            downloadLink.download = `${name}-${version}.tgz`;
        } else {
            downloadLink.download = `${name}-${version}.zip`;
        }

        // Programmatically trigger the download (only once)
        downloadLink.click();

        // Clean up
        window.URL.revokeObjectURL(downloadUrl);

        // Display success message
        const downloadResult = document.getElementById('downloadResult');
        if (downloadResult) {
            downloadResult.style.color = 'green';
            downloadResult.innerHTML = 'Package downloaded successfully!';
            downloadResult.className = 'success-message';

            // Hide the message after 5 seconds
            setTimeout(() => {
                downloadResult.innerHTML = '';
                downloadResult.className = '';
            }, 5000); // 5000ms = 5 seconds
        }

    } catch (error: any) {
        const downloadfailResult = document.getElementById('downloadResult');
        if (downloadfailResult) {
            downloadfailResult.style.color = 'red';
            downloadfailResult.innerHTML = `Download failed: ${error.message}`;
            downloadfailResult.className = 'error-message';
        }

        setTimeout(() => {
            downloadfailResult!.innerHTML = '';
            downloadfailResult!.className = '';
        }, 5000); // 5000ms = 5 seconds
        console.error('Download error:', error);
    }
    finally {
        // Hide loading spinner once the process is complete
        const loadingSpinner: HTMLElement | null = document.getElementById('loadingSpinner2');
        if (loadingSpinner) {
            loadingSpinner.style.display = 'none';
        }
    }
}

/* This function searches for a module using POST /packages */
async function searchModules(): Promise<void> {
    try {
        const loadingSpinner = document.getElementById('loadingSpinner4');
        if (loadingSpinner) loadingSpinner.style.display = 'block';

        const moduleName = (document.getElementById('searchName') as HTMLInputElement).value.toString();
        const moduleRange = (document.getElementById('searchVersion') as HTMLInputElement).value.toString();
        
        let allPackages: any[] = [];
        let offset: string | null = '1';
        const endpoint = `https://dofogoenof.execute-api.us-east-2.amazonaws.com/MainStage/packages?offset=${offset}`;
        // Fetch all pages
        while (offset !== null) {
            const searchResponse = await fetch(endpoint, {
                method: 'POST',
                body: JSON.stringify([{
                    Name: moduleName,
                    Version: moduleRange
                }])
            });

            if (!searchResponse.ok) throw new Error('Package not found');
            
            // Get offset from response headers
            offset = searchResponse.headers.get('offset');
            const packages = await searchResponse.json();
            allPackages = [...allPackages, ...packages];
        }
        // limit the number of packages to display to 30
        allPackages = allPackages.slice(0, 30);

        // Display results
        const resultsDiv = document.getElementById('searchResults');
        if (resultsDiv) {
            if (!allPackages.length) {
                resultsDiv.innerHTML = '<div class="metric-card">No packages found</div>';
            } else {
                resultsDiv.innerHTML = `
                    <div class="metric-card">
                        <div class="card-header">
                            <h3>Search Results</h3>
                            <button class="close-btn" onclick="closeSearchResults()">&times;</button>
                        </div>
                        <div class="package-grid">
                            ${allPackages.map((pkg: any) => `
                                <div class="package-item2">
                                    <h4>${pkg.Name}</h4>
                                    <div class="version">${pkg.Version}</div>
                                    <div class="package-id">ID: ${pkg.ID}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        }
    } catch (error) {
        const resultsDiv = document.getElementById('results');
        if (resultsDiv) {
            resultsDiv.innerHTML = 'Search failed. Please try again.';
        }
        console.error('Search error:', error);
    } finally {
        const loadingSpinner = document.getElementById('loadingSpinner4');
        if (loadingSpinner) loadingSpinner.style.display = 'none';
    }
}

async function getModuleRating(): Promise<void> {
    try {
        // Display loading spinner
        const loadingSpinner: HTMLElement | null = document.getElementById('loadingSpinner3');
        if (loadingSpinner) {
            loadingSpinner.style.display = 'block';
        }
        const ratingResultsElem: HTMLElement | null = document.getElementById('ratingResults');
        if (ratingResultsElem) {
            ratingResultsElem.innerHTML = '';
        }
        const rateModuleNameElement: HTMLInputElement | null = document.getElementById('rateModuleName') as HTMLInputElement;
        let moduleName: string = rateModuleNameElement.value;
        const rateModuleVersionElement: HTMLInputElement | null = document.getElementById('rateModuleVersion') as HTMLInputElement;
        let moduleVersion: string = rateModuleVersionElement.value;

        moduleVersion = moduleVersion.toString();
        moduleName = moduleName.toString();

        if (!moduleName || !moduleVersion) {
            throw new Error('Module name and version are required');
        }
        const reqbody = [{
            Name: moduleName,
            Version: moduleVersion
        }];

        // Get package ID using POST /packages
        const searchResponse: Response = await fetch(`https://dofogoenof.execute-api.us-east-2.amazonaws.com/MainStage/packages`, {
            method: 'POST',
            body: JSON.stringify(reqbody)
        });

        if (!searchResponse.ok) throw new Error('Package not found');
        
        const packages = await searchResponse.json();
        console.log(packages);  // Debugging
        if (!packages.length) throw new Error('Package not found');

        // Get package rating using GET /package/{id}/rate
        const packageId = packages[0].ID;
        const ratingResponse = await fetch(`https://dofogoenof.execute-api.us-east-2.amazonaws.com/MainStage/package/${packageId}/rate`);
        if (!ratingResponse.ok) throw new Error('Failed to retrieve rating');
        const rating = await ratingResponse.json();
        console.log(rating);  // Debugging
        if (!rating) throw new Error('Rating not found');
        // destructure rating object
        const { 
            BusFactor: busfactor,
            BusFactorLatency: busfactor_latency,
            Correctness: correctness,
            CorrectnessLatency: correctness_latency,
            RampUp: rampup,
            RampUpLatency: rampup_latency,
            ResponsiveMaintainer: responsiveMaintainer,
            ResponsiveMaintainerLatency: responsiveMaintainer_latency,
            LicenseScore: license,
            LicenseScoreLatency: license_latency,
            GoodPinningPractice: dependencyPinning,
            GoodPinningPracticeLatency: dependencyPinning_latency,
            PullRequest: reviewedCode,
            PullRequestLatency: reviewedCode_latency,
            NetScore: netscore,
            NetScoreLatency: netscore_latency
        } = rating;
        // Display rating results
        const ratingResultsElement: HTMLElement | null = document.getElementById('ratingResults');
        if (ratingResultsElement) {
            ratingResultsElement.innerHTML = `
                <div class="metric-card">
                    <div class = "card-header">
                        <h3>Package Rating Results</h3>
                        <button class="close-btn" onclick="closeMetricsCard()">&times;</button>
                    </div>
                    <div class="rating-grid">
                        <div class="rating-item">
                            <h4>Overall Score</h4>
                            <div class="score">${netscore.toFixed(2)}</div>
                            <small>Latency: ${netscore_latency}ms</small>
                        </div>
                        <div class="rating-item">
                            <h4>Ramp Up</h4>
                            <div class="score">${rampup.toFixed(2)}</div>
                            <small>Latency: ${rampup_latency}ms</small>
                        </div>
                        <div class="rating-item">
                            <h4>Correctness</h4>
                            <div class="score">${correctness.toFixed(2)}</div>
                            <small>Latency: ${correctness_latency}ms</small>
                        </div>
                        <div class="rating-item">
                            <h4>Bus Factor</h4>
                            <div class="score">${busfactor.toFixed(2)}</div>
                            <small>Latency: ${busfactor_latency}ms</small>
                        </div>
                        <div class="rating-item">
                            <h4>Responsive Maintainer</h4>
                            <div class="score">${responsiveMaintainer.toFixed(2)}</div>
                            <small>Latency: ${responsiveMaintainer_latency}ms</small>
                        </div>
                        <div class="rating-item">
                            <h4>License</h4>
                            <div class="score">${license.toFixed(2)}</div>
                            <small>Latency: ${license_latency}ms</small>
                        </div>
                        <div class="rating-item">
                            <h4>Reviewed Code</h4>
                            <div class="score">${reviewedCode.toFixed(2)}</div>
                            <small>Latency: ${reviewedCode_latency}ms</small>
                        </div>
                        <div class="rating-item">
                            <h4>Dependency Pinning</h4>
                            <div class="score">${dependencyPinning.toFixed(2)}</div>
                            <small>Latency: ${dependencyPinning_latency}ms</small>
                        </div>
                    </div>
                </div>
            `;
        }

        
    } catch (error: any) {
        const ratingResultsElement: HTMLElement | null = document.getElementById('ratingResults');
        if (ratingResultsElement) {
            ratingResultsElement.style.color = 'red';
            ratingResultsElement.innerHTML = error.message;
        }
        console.error('Rating error:', error);
    }
    finally {
        // Hide loading spinner once the process is complete
        const loadingSpinner: HTMLElement | null = document.getElementById('loadingSpinner3');
        if (loadingSpinner) {
            loadingSpinner.style.display = 'none';
        }
    }
}

function clearURLInput() {
    const searchTermElement: HTMLInputElement | null = document.getElementById('npmPackageURL') as HTMLInputElement;
    searchTermElement.value = '';
}

function closeMetricsCard() {
    const ratingResults = document.getElementById('ratingResults');
    if (ratingResults) {
        ratingResults.innerHTML = '';
    }
}

function closeSearchResults() {
    const searchResults = document.getElementById('searchResults');
    if (searchResults) {
        searchResults.innerHTML = '';
    }
}

function removeFile(): void {
    const fileInput: HTMLInputElement = document.getElementById('moduleFile') as HTMLInputElement;
    fileInput.value = '';
    const uploadResultElement: HTMLElement | null = document.getElementById('uploadResult');
    if (uploadResultElement) {
        uploadResultElement.innerHTML = '';
    }
}

function readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                const base64String = reader.result.split(',')[1];
                resolve(base64String);
            } else {
                reject(new Error('Failed to read file as base64 string'));
            }
        };
        reader.onerror = () => reject(new Error('Error reading file'));
        reader.readAsDataURL(file);
    });
}
