import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { db, storage } from '../firebase/config';
import { doc, getDoc, collection, query, where, getDocs, orderBy, updateDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Box, Breadcrumbs, Typography, Paper, Alert, Button } from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ProductForm from '../components/ProductForm';
import ModifierGroupsEditor from '../components/ModifierGroupsEditor';

const num = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;

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

export default function EditProductPage() {
  const { uuidEmpresa, productId } = useParams();
  const navigate = useNavigate();

  const [businessData, setBusinessData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [initialValues, setInitialValues] = useState(null);
  const [productUuid, setProductUuid] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchAll = useCallback(async () => {
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

      const pSnap = await getDoc(doc(db, 'productos', productId));
      if (!pSnap.exists()) throw new Error('Producto no encontrado');
      const p = pSnap.data();
      setProductUuid(p.uuid || '');

      setInitialValues({
        name: p.name || '',
        description: p.description || '',
        price: num(p.price || 0),
        adicional_para_la_app: num(p.adicional_para_la_app || 0),
        sale_price: num(p.sale_price || 0),
        quantity: num(p.quantity || 0),
        Imagen: p.Imagen || '',
        posicion: num(p.posicion || 0),
        tiene_descuento: !!p.tiene_descuento,
        precio_descuento: num(p.precio_descuento || 0),
        disponible: p.disponible !== false,
        producto_destacado: !!p.producto_destacado,
        categorias: Array.isArray(p.categorias) ? p.categorias : [],
        categoriaenTexto: p.categoriaenTexto || (Array.isArray(p.categorias) ? p.categorias[0] : ''),
        subCategoriasText: Array.isArray(p.subCategoriasText) ? p.subCategoriasText : [],
        sku: p.sku || '',
        variantesProducto: Array.isArray(p.variantesProducto) ? p.variantesProducto.map(v => ({ ...v, _id: Math.random() })) : [],
        gruposDeExtras: Array.isArray(p.gruposDeExtras) ? p.gruposDeExtras.map(g => ({ ...g, _gid: Math.random(), items: (g.items || []).map(it => ({ ...it, _iid: Math.random() })) })) : [],
      });
    } catch (err) {
      console.error(err);
      setErrorMsg('No se pudo cargar la información necesaria.');
    } finally {
      setLoading(false);
    }
  }, [uuidEmpresa, productId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSubmit = async (values, imageFile) => {
    setErrorMsg('');
    setSubmitting(true);
    try {
      let imageUrl = values.Imagen || '';
      if (imageFile) {
        const path = `product_images/${uuidEmpresa}/${productUuid || productId}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, imageFile);
        imageUrl = await getDownloadURL(storageRef);
      }

      await updateDoc(doc(db, 'productos', productId), {
        ...values,
        Imagen: imageUrl,
        modified_at: Timestamp.now(),
        searchKeywords: generateSearchKeywords(values.name), // <-- CAMPO AÑADIDO AQUÍ
      });

      navigate(-1);
    } catch (err) {
      console.error(err);
      setErrorMsg('Error al actualizar el producto.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Typography>Cargando...</Typography>;
  if (!businessData) return <Typography>No se encontró el negocio.</Typography>;
  if (!initialValues) return <Typography>No se encontró el producto.</Typography>;

  return (
    <Box>
      <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 2 }}>
        <Link to="/negocios" style={{ textDecoration: 'none', color: 'inherit' }}>Negocios</Link>
        <Link to={`/negocios/${uuidEmpresa}/productos`} style={{ textDecoration: 'none', color: 'inherit' }}>Productos</Link>
        <Typography color="text.primary">Editar</Typography>
      </Breadcrumbs>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h5" sx={{ mb: 2 }}>Editar producto</Typography>
        {errorMsg && <Alert severity="error" sx={{ mb: 2 }}>{errorMsg}</Alert>}

        <ProductForm
          isSupermarket={businessData.mostrarComoSuper === true}
          categories={categories}
          initialValues={initialValues}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      </Paper>

      {productUuid && (
        <Paper sx={{ p: 2 }}>
          <ModifierGroupsEditor uuidEmpresa={uuidEmpresa} productUuid={productUuid} />
        </Paper>
      )}
    </Box>
  );
}