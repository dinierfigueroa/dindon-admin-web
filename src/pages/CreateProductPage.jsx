import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { db, storage } from '../firebase/config';
import { collection, query, where, getDocs, orderBy, addDoc, Timestamp, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Box, Breadcrumbs, Typography, Paper, Alert, Button } from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ProductForm from '../components/ProductForm';

const baseValues = {
  name: '', description: '',
  price: 0, adicional_para_la_app: 0, sale_price: 0,
  quantity: 0, Imagen: '', posicion: 0,
  tiene_descuento: false, precio_descuento: 0,
  disponible: true, producto_destacado: false,
  categorias: [], categoriaenTexto: '',
  subCategoriasText: [], variantesProducto: [],
  gruposDeExtras: [], tags: [], sku: ''
};

// --- FUNCIÓN AUXILIAR PARA GENERAR KEYWORDS ---
const generateSearchKeywords = (name) => {
  if (!name) return [];
  const lowerCaseName = name.toLowerCase();
  const keywords = new Set();

  // 1. Genera los prefijos en minúscula (a partir de 4 letras como pediste)
  for (let i = 4; i <= lowerCaseName.length; i++) {
    keywords.add(lowerCaseName.substring(0, i));
  }

  // 2. Añade cada palabra individual en minúscula Y con la primera letra en mayúscula
  lowerCaseName.split(' ').forEach(word => {
    if (word) {
      keywords.add(word); // ej. "pollo"
      const capitalizedWord = word.charAt(0).toUpperCase() + word.slice(1);
      keywords.add(capitalizedWord); // ej. "Pollo"
    }
  });

  return Array.from(keywords);
};

export default function CreateProductPage() {
  const { uuidEmpresa } = useParams();
  const navigate = useNavigate();
  const [businessData, setBusinessData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchMeta = useCallback(async () => {
    setLoading(true);
    try {
      const bq = query(collection(db, 'NegociosAfiliados'), where('uuidEmpresa', '==', uuidEmpresa));
      const bs = await getDocs(bq);
      if (bs.empty) throw new Error('Negocio no encontrado');
      const business = bs.docs[0].data();
      setBusinessData(business);

      const cq = query(collection(db, 'Categorias'), where('uuidEmpresa', '==', uuidEmpresa), orderBy('posicion', 'asc'));
      const cs = await getDocs(cq);
      setCategories(cs.docs.map(d => ({ firestoreId: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
      setErrorMsg('No se pudo cargar negocio/categorías.');
    } finally {
      setLoading(false);
    }
  }, [uuidEmpresa]);

  useEffect(() => { fetchMeta(); }, [fetchMeta]);

  const initialValues = useMemo(() => {
    if (!businessData) return baseValues;
    return businessData.mostrarComoSuper === true
      ? { ...baseValues, subCategoriasText: ['Todos'] } // default 'Todos'
      : baseValues;
  }, [businessData]);

  const handleSubmit = async (values, imageFile) => {
    setErrorMsg('');
    setSubmitting(true);
    try {
      const productUuid = uuidv4();
      const payload = {
        ...values,
        uuid: productUuid,
        uuidEmpresa,
        Empresa: businessData?.NombredelNegocio || '',
        Imagen: '',
        created_at: Timestamp.now(),
        modified_at: Timestamp.now(),
        searchKeywords: generateSearchKeywords(values.name), // <-- CAMPO AÑADIDO AQUÍ
      };
      const docRef = await addDoc(collection(db, 'productos'), payload);

      if (imageFile) {
        const storageRef = ref(storage, `product_images/${uuidEmpresa}/${productUuid}`);
        await uploadBytes(storageRef, imageFile);
        const imageUrl = await getDownloadURL(storageRef);
        await updateDoc(doc(db, 'productos', docRef.id), { Imagen: imageUrl, modified_at: Timestamp.now() });
      }

      navigate(-1);
    } catch (err) {
      console.error(err);
      setErrorMsg('Error al guardar el producto.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Typography>Cargando...</Typography>;
  if (!businessData) return <Typography>No se encontró el negocio.</Typography>;

  return (
    <Box>
      <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 2 }}>
        <Link to="/negocios" style={{ textDecoration: 'none', color: 'inherit' }}>Negocios</Link>
        <Link to={`/negocios/${uuidEmpresa}/productos`} style={{ textDecoration: 'none', color: 'inherit' }}>Productos</Link>
        <Typography color="text.primary">Nuevo</Typography>
      </Breadcrumbs>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h5" sx={{ mb: 2 }}>Crear producto</Typography>
        {errorMsg && <Alert severity="error" sx={{ mb: 2 }}>{errorMsg}</Alert>}

        <ProductForm
          isSupermarket={businessData.mostrarComoSuper === true}
          categories={categories}
          initialValues={initialValues}
          onSubmit={handleSubmit}
          submitting={submitting}
        />

        <Box mt={2}>
          <Button onClick={() => navigate(-1)}>Cancelar</Button>
        </Box>
      </Paper>
    </Box>
  );
}