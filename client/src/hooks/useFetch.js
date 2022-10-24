import { useState, useEffect, useCallback } from "react";
import axios from "axios";

const useFetch = (query, page) => {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);
	const [movies, setMovies] = useState([]);

	const sendQuery = useCallback(async () => {
		try {
			setLoading(true)
			setError(false)
			const { data } = await axios.get(url)
			setMovies(prevMovies => [...prevMovies, ...data.results])
			setLoading(false)
		} catch (err) {
			setError(err)
		}
	}, [query, page]);

	useEffect(() => {
		sendQuery(query);
	}, [query, page, sendQuery]);

	return { loading, error, movies };
}

export default useFetch;
